import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";

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
    const userSnapshot = await adminDb
      .collection("users")
      .doc(decodedToken.uid)
      .get();
    const userRole = userSnapshot.data()?.role ?? "basic";

    if (userRole !== "admin" && userRole !== "approver") {
      return NextResponse.json(
        { error: "Usuário sem permissão para arquivar chamados." },
        { status: 403 },
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

    const currentTicket = ticketSnapshot.data() ?? {};
    const previousStatus =
      typeof currentTicket.status === "string"
        ? currentTicket.status
        : "pending_approval";

    await ticketRef.update({
      status: "archived",
      previousStatus:
        previousStatus === "archived"
          ? (currentTicket.previousStatus ?? previousStatus)
          : previousStatus,
      archivedBy: {
        uid: decodedToken.uid,
        name: decodedToken.name ?? "Usuário",
        email: decodedToken.email ?? "",
      },
      archivedAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ ok: true, ticketId, status: "archived" });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível arquivar o chamado.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
