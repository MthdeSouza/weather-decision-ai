import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { getHistoricalClimateContext } from "@/lib/open-meteo";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      return NextResponse.json({ error: "Token ausente." }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const body = await request.json();
    const ticketId = typeof body?.ticketId === "string" ? body.ticketId : "";

    if (!ticketId.trim()) {
      return NextResponse.json(
        { error: "ticketId obrigatório." },
        { status: 400 },
      );
    }

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

    const city =
      typeof ticket.construction?.city === "string"
        ? ticket.construction.city
        : "";
    const state =
      typeof ticket.construction?.state === "string"
        ? ticket.construction.state
        : "";
    const startDate =
      typeof ticket.construction?.startDate === "string"
        ? ticket.construction.startDate
        : undefined;

    const climateContext = await getHistoricalClimateContext({
      city,
      state,
      startDate,
    });

    await ticketRef.update({
      status: "pending_ai_analysis",
      approval: {
        approvedBy: {
          uid: decodedToken.uid,
          name: decodedToken.name ?? "Usuário",
          email: decodedToken.email ?? "",
        },
        approvedAt: new Date(),
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
      },
      climateContext,
      updatedAt: new Date(),
    });

    return NextResponse.json({ ok: true, climateContext });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível aprovar o chamado.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
