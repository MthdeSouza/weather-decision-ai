import { randomUUID } from "node:crypto";

import { adminDb } from "@/lib/firebase-admin";
import {
  getHistoricalClimateContext,
  type HistoricalClimateContext,
} from "@/lib/open-meteo";
import { createProcessingDiagnostics as buildProcessingDiagnostics } from "@/lib/processing-diagnostics";
import {
  canBeginTicketProcessing,
  isProcessingRunStale,
} from "@/lib/ticket-workflow";
import {
  AI_ANALYSIS_PROMPT_VERSION,
  generateConstructionAnalysisReport,
} from "@/services/gemini";

export type TicketProcessorActor = {
  uid: string;
  name?: string;
  email?: string;
  role?: string;
};

export type TicketProcessingResult = {
  ok: boolean;
  status: "processing" | "completed" | "failed";
  ticketId: string;
  analysisId?: string;
  report?: Record<string, unknown>;
  error?: string;
};

export const createProcessingDiagnostics = buildProcessingDiagnostics;

export async function beginTicketProcessing(
  ticketId: string,
  actor: TicketProcessorActor,
) {
  const ticketRef = adminDb.collection("tickets").doc(ticketId);
  const runId = `analysis-${Date.now()}-${randomUUID()}`;

  await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ticketRef);

    if (!snapshot.exists) {
      throw new Error("Chamado não encontrado.");
    }

    const ticket = snapshot.data() ?? {};
    const currentStatus =
      typeof ticket.status === "string" ? ticket.status : "";

    const allowsReanalysis =
      canBeginTicketProcessing(currentStatus) ||
      (currentStatus === "processing" &&
        isProcessingRunStale(ticket.processingStartedAt));

    if (currentStatus === "processing" && !allowsReanalysis) {
      throw new Error("Este chamado já está em processamento.");
    }

    if (!allowsReanalysis) {
      throw new Error(
        `Este chamado não está em um status elegível para nova análise: ${currentStatus}.`,
      );
    }

    transaction.update(ticketRef, {
      status: "processing",
      processingRunId: runId,
      processingRequestedBy: {
        uid: actor.uid,
        name: actor.name ?? "Sistema",
        email: actor.email ?? "",
        role: actor.role ?? "approver",
      },
      processingStartedAt: new Date(),
      iaAnalysis: null,
      aiAnalysisMeta: null,
      processingDiagnostics: null,
      updatedAt: new Date(),
    });
  });

  return runId;
}

export async function finalizeTicketAnalysis(
  ticketId: string,
  runId: string,
  report: Record<string, unknown>,
  climateContext: HistoricalClimateContext,
) {
  const ticketRef = adminDb.collection("tickets").doc(ticketId);

  await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ticketRef);

    if (!snapshot.exists) {
      throw new Error("Chamado não encontrado ao finalizar análise.");
    }

    const ticket = snapshot.data() ?? {};
    const currentRunId = ticket.processingRunId;

    if (
      currentRunId !== runId ||
      ticket.status !== "processing"
    ) {
      throw new Error("Outra execução substituiu esta análise em andamento.");
    }

    const executedAt = new Date();
    transaction.update(ticketRef, {
      status: "completed",
      iaAnalysis: JSON.stringify(report, null, 2),
      aiAnalysisMeta: {
        id: runId,
        executedAt: executedAt.toISOString(),
        model: "gemini-2.5-flash",
        promptVersion: AI_ANALYSIS_PROMPT_VERSION,
        dataSources: [
          "Open-Meteo Historical Weather API (ERA5-LAND)",
          "Firestore ticket data",
          "Gemini model structured report",
        ],
        status: "completed",
        result: report,
      },
      climateContext,
      processingRunId: runId,
      processingFinishedAt: executedAt,
      updatedAt: executedAt,
    });
  });
}

export async function markTicketAnalysisFailed(
  ticketId: string,
  runId: string,
  error: unknown,
  stage: string,
) {
  const ticketRef = adminDb.collection("tickets").doc(ticketId);
  const diagnostic = createProcessingDiagnostics(error, stage);

  await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ticketRef);

    if (!snapshot.exists) {
      throw new Error("Chamado não encontrado ao registrar falha.");
    }

    const ticket = snapshot.data() ?? {};
    const currentRunId = ticket.processingRunId;

    if (
      currentRunId !== runId ||
      ticket.status !== "processing"
    ) {
      return;
    }

    transaction.update(ticketRef, {
      status: "failed",
      processingRunId: runId,
      processingFinishedAt: new Date(),
      processingDiagnostics: diagnostic,
      updatedAt: new Date(),
    });
  });

  return diagnostic;
}

export async function processApprovedTicket(
  ticketId: string,
  actor: TicketProcessorActor,
): Promise<TicketProcessingResult> {
  const ticketRef = adminDb.collection("tickets").doc(ticketId);
  let runId = "";

  try {
    runId = await beginTicketProcessing(ticketId, actor);
    const ticketSnapshot = await ticketRef.get();

    if (!ticketSnapshot.exists) {
      throw new Error("Chamado não encontrado durante a execução.");
    }

    const ticket = ticketSnapshot.data() ?? {};
    const construction = ticket.construction ?? {};
    const city = typeof construction.city === "string" ? construction.city : "";
    const state =
      typeof construction.state === "string" ? construction.state : "";
    const startDate =
      typeof construction.startDate === "string"
        ? construction.startDate
        : new Date().toISOString().slice(0, 10);
    const estimatedMonths = Number(construction.estimatedMonths ?? 6);
    const builtArea = Number(construction.builtArea ?? 0);
    const propertyType =
      typeof construction.propertyType === "string"
        ? construction.propertyType
        : "other";
    const constructionType =
      typeof construction.constructionType === "string"
        ? construction.constructionType
        : "mixed";

    let climateContext: HistoricalClimateContext;
    try {
      climateContext = await getHistoricalClimateContext({
        city,
        state,
        startDate,
      });
    } catch (error) {
      await markTicketAnalysisFailed(
        ticketId,
        runId,
        error,
        "consulta_climatica",
      );
      return {
        ok: false,
        status: "failed",
        ticketId,
        error: "Falha na consulta de clima/geocodificação.",
      };
    }

    const report = await generateConstructionAnalysisReport({
      ticket: {
        city,
        state,
        propertyType,
        constructionType,
        builtArea,
        startDate,
        estimatedMonths,
      },
      climateContext,
    });

    await finalizeTicketAnalysis(
      ticketId,
      runId,
      report,
      climateContext,
    );

    return {
      ok: true,
      status: "completed",
      ticketId,
      analysisId: runId,
      report,
    };
  } catch (error) {
    const description = error instanceof Error ? error.message : String(error);
    const duplicateError =
      description.includes("já foi concluído") ||
      description.includes("já está em processamento") ||
      description.includes("não encontrado");

    if (duplicateError) {
      return {
        ok: false,
        status: "processing",
        ticketId,
        error: description,
      };
    }

    const stage = "gemini";
    const diagnostic = createProcessingDiagnostics(error, stage);

    if (runId) {
      try {
        await markTicketAnalysisFailed(ticketId, runId, error, stage);
      } catch (persistError) {
        console.error("[ticket-processing] could not persist failure state", {
          ticketId,
          runId,
          errorType:
            persistError instanceof Error
              ? persistError.name
              : "UnknownError",
        });
      }
    }

    return {
      ok: false,
      status: "failed",
      ticketId,
      error: diagnostic.message,
    };
  }
}
