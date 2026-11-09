import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { processApprovedTicket } from "@/lib/ticket-processing";

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
        {
          error:
            "Usuário sem permissão para executar processamento do chamado.",
        },
        { status: 403 },
      );
    }

    const result = await processApprovedTicket(ticketId, {
      uid: decodedToken.uid,
      name: decodedToken.name ?? "Usuário",
      email: decodedToken.email ?? "",
      role: userRole,
    });

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
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível iniciar o processamento.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
