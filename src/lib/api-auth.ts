import "server-only";

import { createHash } from "node:crypto";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { isPrivilegedRole } from "@/lib/ticket-workflow";
import type { UserRole } from "@/types/user";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export type ApiActor = {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
};

export async function requireFirebaseActor(
  request: Request,
  allowedRoles?: UserRole[],
): Promise<ApiActor> {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw new ApiRequestError("Autenticação obrigatória.", 401);
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(match[1], true);
  } catch {
    throw new ApiRequestError("Sessão inválida ou expirada.", 401);
  }

  const userSnapshot = await adminDb
    .collection("users")
    .doc(decodedToken.uid)
    .get();
  const profile = userSnapshot.data();

  if (!profile) {
    throw new ApiRequestError("Perfil de usuário não encontrado.", 403);
  }

  const role: UserRole = isPrivilegedRole(profile.role)
    ? profile.role
    : "basic";

  if (allowedRoles && !allowedRoles.includes(role)) {
    throw new ApiRequestError("Usuário sem permissão.", 403);
  }

  return {
    uid: decodedToken.uid,
    name:
      typeof profile.name === "string"
        ? profile.name
        : (decodedToken.name ?? "Usuário"),
    email:
      typeof profile.email === "string"
        ? profile.email
        : (decodedToken.email ?? ""),
    role,
  };
}

export async function consumeApiRateLimit(
  uid: string,
  operation: string,
  maximum: number,
  windowMs: number,
) {
  const key = createHash("sha256")
    .update(`${operation}:${uid}`)
    .digest("hex");
  const rateLimitRef = adminDb.collection("apiRateLimits").doc(key);
  const now = Date.now();

  await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(rateLimitRef);
    const current = snapshot.data();
    const windowStartedAtMs =
      typeof current?.windowStartedAtMs === "number"
        ? current.windowStartedAtMs
        : 0;
    const count =
      now - windowStartedAtMs < windowMs && typeof current?.count === "number"
        ? current.count
        : 0;

    if (count >= maximum) {
      throw new ApiRequestError(
        "Limite de solicitações atingido. Tente novamente mais tarde.",
        429,
      );
    }

    transaction.set(rateLimitRef, {
      windowStartedAtMs: count === 0 ? now : windowStartedAtMs,
      count: count + 1,
      updatedAt: new Date(now),
    });
  });
}

export function apiErrorResponse(error: unknown, operation: string) {
  if (error instanceof ApiRequestError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  const errorType = error instanceof Error ? error.name : "UnknownError";
  console.error(`[api:${operation}] request failed`, { errorType });
  return Response.json(
    { error: "Não foi possível concluir a solicitação." },
    { status: 500 },
  );
}
