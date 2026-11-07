import { NextResponse } from "next/server";

import { analyzeDecision } from "@/services/gemini";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message : "";
    const city = typeof body?.city === "string" ? body.city : undefined;
    const state = typeof body?.state === "string" ? body.state : undefined;

    if (!message.trim()) {
      return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
    }

    const result = await analyzeDecision(message, city, state);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        summary: "Não foi possível analisar a decisão no momento.",
        recommendation: "Tente novamente em alguns instantes.",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Weather Decision AI está online.",
  });
}
