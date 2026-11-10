import { NextResponse } from "next/server";
import { z } from "zod";

import {
  apiErrorResponse,
  ApiRequestError,
  requireFirebaseActor,
} from "@/lib/api-auth";
import { sendPendingApprovalNotification } from "@/lib/approval-email";
import { adminDb } from "@/lib/firebase-admin";
import {
  canCreatePendingApprovalTicket,
  initialTicketStatus,
  MAX_PENDING_APPROVAL_TICKETS,
} from "@/lib/ticket-workflow";

const ticketInputSchema = z
  .object({
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(100),
    propertyType: z.enum([
      "residential",
      "commercial",
      "industrial",
      "warehouse",
      "infrastructure",
      "other",
    ]),
    constructionType: z.enum([
      "masonry",
      "steel_frame",
      "wood_frame",
      "concrete",
      "mixed",
      "other",
    ]),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => {
        const date = new Date(`${value}T00:00:00.000Z`);
        return (
          Number.isFinite(date.getTime()) &&
          date.toISOString().slice(0, 10) === value
        );
      }),
    estimatedMonths: z.number().int().positive().max(1200),
    builtArea: z.number().positive().max(10_000_000),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const actor = await requireFirebaseActor(request);
    const body = await request.json().catch(() => null);
    const parsedInput = ticketInputSchema.safeParse(body);

    if (!parsedInput.success) {
      throw new ApiRequestError("Dados do chamado inválidos.", 400);
    }

    const input = parsedInput.data;
    const status = initialTicketStatus(actor.role);
    const ticketRef = adminDb.collection("tickets").doc();
    const now = new Date();
    const ticket = {
      id: ticketRef.id,
      createdBy: {
        uid: actor.uid,
        name: actor.name,
        email: actor.email,
      },
      construction: {
        ...input,
        type: input.propertyType,
      },
      status,
      approval: {
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
      },
      iaAnalysis: null,
      aiAnalysisMeta: null,
      climateContext: null,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb.runTransaction(async (transaction) => {
      if (status === "pending_approval") {
        const lockRef = adminDb
          .collection("ticketCreationLocks")
          .doc(actor.uid);
        const pendingTicketsQuery = adminDb
          .collection("tickets")
          .where("createdBy.uid", "==", actor.uid)
          .where("status", "==", "pending_approval")
          .limit(MAX_PENDING_APPROVAL_TICKETS);

        await transaction.get(lockRef);
        const pendingTickets = await transaction.get(pendingTicketsQuery);

        if (!canCreatePendingApprovalTicket(pendingTickets.size)) {
          throw new ApiRequestError(
            `Você já possui ${MAX_PENDING_APPROVAL_TICKETS} chamados aguardando aprovação. Aguarde a análise antes de abrir outro.`,
            409,
          );
        }

        transaction.set(lockRef, { updatedAt: now });
      }

      transaction.create(ticketRef, ticket);
    });

    let notificationSent = true;
    if (status === "pending_approval") {
      try {
        await sendPendingApprovalNotification({
          ticketId: ticketRef.id,
          requesterName: actor.name,
          requesterEmail: actor.email,
          city: input.city,
          state: input.state,
        });
      } catch (error) {
        console.error("[api:ticket-creation] approval notification failed", {
          ticketId: ticketRef.id,
          errorType: error instanceof Error ? error.name : "UnknownError",
        });
        notificationSent = false;
      }
    }

    return NextResponse.json(
      { ok: true, ticketId: ticketRef.id, notificationSent },
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, "ticket-creation");
  }
}
