import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { getHistoricalClimateContext } from "@/lib/open-meteo";
import { AI_ANALYSIS_PROMPT_VERSION, generateConstructionAnalysisReport } from "@/services/gemini";

export async function POST(
  request: Request,
  context: { params: Promise<{ ticketId: string }> },
) {
  try {
    const { ticketId } = await context.params;
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      return NextResponse.json({ error: "Token ausente." }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const ticketRef = adminDb.collection("tickets").doc(ticketId);
    const ticketSnapshot = await ticketRef.get();

    if (!ticketSnapshot.exists) {
      return NextResponse.json(
        { error: "Chamado não encontrado." },
        { status: 404 },
      );
    }

    const ticket = ticketSnapshot.data();

    if (!ticket) {
      return NextResponse.json(
        { error: "Dados do chamado inválidos." },
        { status: 400 },
      );
    }

    const construction = ticket.construction ?? {};
    const city = typeof construction.city === "string" ? construction.city : "";
    const state = typeof construction.state === "string" ? construction.state : "";
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

    const climateContext =
      ticket.climateContext ??
      (await getHistoricalClimateContext({
        city,
        state,
        startDate,
      }));

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

    const analysisId = `analysis-${Date.now()}`;
    const executionDate = new Date().toISOString();

    const analysisRecord = {
      id: analysisId,
      ticketId,
      createdBy: {
        uid: decodedToken.uid,
        name: decodedToken.name ?? "Sistema",
        email: decodedToken.email ?? "",
      },
      executedAt: executionDate,
      model: "gemini-2.0-flash",
      promptVersion: AI_ANALYSIS_PROMPT_VERSION,
      dataSources: [
        "Open-Meteo Historical Weather API (ERA5-LAND)",
        "Firestore ticket data",
        "Gemini model structured report",
      ],
      result: report,
      status: "completed",
    };

    await adminDb.collection("ticketAnalyses").doc(analysisId).set(analysisRecord);

    await ticketRef.update({
      status: "completed",
      iaAnalysis: JSON.stringify(report, null, 2),
      aiAnalysisMeta: {
        id: analysisId,
        executedAt: executionDate,
        model: "gemini-2.0-flash",
        promptVersion: AI_ANALYSIS_PROMPT_VERSION,
        dataSources: analysisRecord.dataSources,
        status: "completed",
        result: report,
      },
      updatedAt: new Date(),
    });

    return NextResponse.json({ ok: true, report, analysisId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível concluir a análise.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
