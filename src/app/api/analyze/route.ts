import { NextResponse } from "next/server";

import {
  apiErrorResponse,
  ApiRequestError,
  consumeApiRateLimit,
  requireFirebaseActor,
} from "@/lib/api-auth";
import { analyzeDecision } from "@/services/gemini";

export async function POST(request: Request) {
  try {
    const actor = await requireFirebaseActor(request);
    await consumeApiRateLimit(actor.uid, "chat-analysis", 8, 60_000);

    const rawBody = await request.text();
    if (rawBody.length > 8_192) {
      throw new ApiRequestError("A solicitação excede o tamanho permitido.", 413);
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw new ApiRequestError("Corpo JSON inválido.", 400);
    }

    const message = typeof body.message === "string" ? body.message.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : undefined;
    const state =
      typeof body.state === "string" ? body.state.trim() : undefined;

    if (!message || message.length > 2_000) {
      throw new ApiRequestError(
        "A mensagem deve ter entre 1 e 2000 caracteres.",
        400,
      );
    }
    if (city && city.length > 100) {
      throw new ApiRequestError("Cidade inválida.", 400);
    }
    if (state && state.length > 100) {
      throw new ApiRequestError("Estado inválido.", 400);
    }

    return NextResponse.json(await analyzeDecision(message, city, state));
  } catch (error) {
    return apiErrorResponse(error, "chat-analysis");
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Weather Decision AI está online.",
  });
}
