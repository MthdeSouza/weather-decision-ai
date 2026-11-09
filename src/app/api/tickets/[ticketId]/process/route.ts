import { NextResponse } from "next/server";

import {
  apiErrorResponse,
  ApiRequestError,
  consumeApiRateLimit,
  requireFirebaseActor,
} from "@/lib/api-auth";
import { processApprovedTicket } from "@/lib/ticket-processing";

export async function POST(
  request: Request,
  context: { params: Promise<{ ticketId: string }> },
) {
  try {
    const actor = await requireFirebaseActor(request, ["admin"]);
    await consumeApiRateLimit(actor.uid, "ticket-processing", 5, 60 * 60 * 1000);
    const { ticketId } = await context.params;

    if (!/^[A-Za-z0-9_-]{1,128}$/.test(ticketId)) {
      throw new ApiRequestError("Identificador de chamado inválido.", 400);
    }

    const result = await processApprovedTicket(ticketId, actor);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          status: result.status,
          ticketId,
          error: result.error,
        },
        { status: result.status === "processing" ? 409 : 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      ticketId,
      status: result.status,
      report: result.report,
      analysisId: result.analysisId,
    });
  } catch (error) {
    return apiErrorResponse(error, "ticket-processing");
  }
}
