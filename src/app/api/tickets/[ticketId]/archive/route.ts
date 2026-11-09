import { NextResponse } from "next/server";

import {
  apiErrorResponse,
  ApiRequestError,
  consumeApiRateLimit,
  requireFirebaseActor,
} from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(
  request: Request,
  context: { params: Promise<{ ticketId: string }> },
) {
  try {
    const actor = await requireFirebaseActor(request, ["admin"]);
    await consumeApiRateLimit(actor.uid, "ticket-archive", 20, 60 * 60 * 1000);
    const { ticketId } = await context.params;

    if (!/^[A-Za-z0-9_-]{1,128}$/.test(ticketId)) {
      throw new ApiRequestError("Identificador de chamado inválido.", 400);
    }

    const ticketRef = adminDb.collection("tickets").doc(ticketId);
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ticketRef);

      if (!snapshot.exists) {
        throw new ApiRequestError("Chamado não encontrado.", 404);
      }

      const ticket = snapshot.data() ?? {};
      if (ticket.status === "archived") {
        throw new ApiRequestError("O chamado já está arquivado.", 409);
      }

      transaction.update(ticketRef, {
        status: "archived",
        previousStatus: ticket.status,
        archivedBy: {
          uid: actor.uid,
          name: actor.name,
          email: actor.email,
        },
        archivedAt: new Date(),
        updatedAt: new Date(),
      });
    });

    return NextResponse.json({ ok: true, ticketId, status: "archived" });
  } catch (error) {
    return apiErrorResponse(error, "ticket-archive");
  }
}
