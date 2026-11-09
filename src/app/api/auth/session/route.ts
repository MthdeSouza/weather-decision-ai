import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { ApiRequestError, apiErrorResponse } from "@/lib/api-auth";

const SESSION_COOKIE_NAME = "weather-decision-auth";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new ApiRequestError("Autenticação obrigatória.", 401);
    }

    const decoded = await adminAuth.verifyIdToken(match[1], true).catch(() => {
      throw new ApiRequestError("Sessão inválida ou expirada.", 401);
    });
    const profile = await adminDb.collection("users").doc(decoded.uid).get();
    if (!profile.exists) {
      throw new ApiRequestError("Perfil de usuário não encontrado.", 403);
    }

    const sessionCookie = await adminAuth.createSessionCookie(match[1], {
      expiresIn: SESSION_DURATION_MS,
    });
    const response = NextResponse.json({ ok: true });

    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_MS / 1000,
    });

    return response;
  } catch (error) {
    return apiErrorResponse(error, "session-create");
  }
}

export async function DELETE(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
