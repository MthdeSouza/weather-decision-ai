import { NextResponse } from "next/server";

import {
  apiErrorResponse,
  ApiRequestError,
  consumeApiRateLimit,
  requireFirebaseActor,
} from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { canApproveTicket } from "@/lib/ticket-workflow";
import { processApprovedTicket } from "@/lib/ticket-processing";

export async function POST(request: Request) {
  try {
    const actor = await requireFirebaseActor(request, ["approver", "admin"]);
    await consumeApiRateLimit(actor.uid, "ticket-approval", 10, 60 * 60 * 1000);

    const body = await request.json().catch(() => null);
    const ticketId =
      typeof body?.ticketId === "string" ? body.ticketId.trim() : "";

    if (!/^[A-Za-z0-9_-]{1,128}$/.test(ticketId)) {
      throw new ApiRequestError("Identificador de chamado inválido.", 400);
    }

    const ticketRef = adminDb.collection("tickets").doc(ticketId);
    await adminDb.runTransaction(async (transaction) => {
      const ticketSnapshot = await transaction.get(ticketRef);

      if (!ticketSnapshot.exists) {
        throw new ApiRequestError("Chamado não encontrado.", 404);
      }

      const ticket = ticketSnapshot.data() ?? {};
      if (!canApproveTicket(ticket.status)) {
        throw new ApiRequestError(
          "O chamado não está aguardando aprovação.",
          409,
        );
      }

      transaction.update(ticketRef, {
        status: "pending_ai_analysis",
        approval: {
          approvedBy: {
            uid: actor.uid,
            name: actor.name,
            email: actor.email,
          },
          approvedAt: new Date(),
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null,
        },
        updatedAt: new Date(),
      });
    });

    const processingResult = await processApprovedTicket(ticketId, actor);

    return NextResponse.json({
      ok: processingResult.ok,
      status: processingResult.status,
      ticketId,
      analysisId: processingResult.analysisId,
      report: processingResult.report,
      error: processingResult.error,
    }, { status: processingResult.ok ? 200 : 502 });
  } catch (error) {
    return apiErrorResponse(error, "ticket-approval");
  }
}
