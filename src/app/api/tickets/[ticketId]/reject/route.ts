import { NextResponse } from "next/server";

import {
  apiErrorResponse,
  ApiRequestError,
  consumeApiRateLimit,
  requireFirebaseActor,
} from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { canRejectTicket } from "@/lib/ticket-workflow";

export async function POST(
  request: Request,
  context: { params: Promise<{ ticketId: string }> },
) {
  try {
    const actor = await requireFirebaseActor(request, ["approver", "admin"]);
    await consumeApiRateLimit(actor.uid, "ticket-rejection", 10, 60 * 60 * 1000);
    const { ticketId } = await context.params;

    if (!/^[A-Za-z0-9_-]{1,128}$/.test(ticketId)) {
      throw new ApiRequestError("Identificador de chamado inválido.", 400);
    }

    const body = await request.json().catch(() => null);
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 3 || reason.length > 1000) {
      throw new ApiRequestError(
        "A justificativa deve ter entre 3 e 1000 caracteres.",
        400,
      );
    }

    const ticketRef = adminDb.collection("tickets").doc(ticketId);
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ticketRef);

      if (!snapshot.exists) {
        throw new ApiRequestError("Chamado não encontrado.", 404);
      }

      if (!canRejectTicket(snapshot.data()?.status)) {
        throw new ApiRequestError(
          "O chamado não está aguardando aprovação.",
          409,
        );
      }

      transaction.update(ticketRef, {
        status: "rejected",
        approval: {
          approvedBy: null,
          approvedAt: null,
          rejectedBy: {
            uid: actor.uid,
            name: actor.name,
            email: actor.email,
          },
          rejectedAt: new Date(),
          rejectionReason: reason,
        },
        updatedAt: new Date(),
      });
    });

    return NextResponse.json({ ok: true, ticketId, status: "rejected" });
  } catch (error) {
    return apiErrorResponse(error, "ticket-rejection");
  }
}
