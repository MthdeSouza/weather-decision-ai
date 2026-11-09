import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { canAccessRole } from "@/lib/ticket-workflow";
import type { UserRole } from "@/types/user";

const redirectToLogin = async (): Promise<never> => {
  const pathname = (await headers()).get("x-pathname");
  const returnTo =
    pathname && pathname.startsWith("/") && !pathname.startsWith("//")
      ? pathname
      : "/";
  redirect(`/login?callbackUrl=${encodeURIComponent(returnTo)}`);
};

export async function requireServerSession(allowedRoles?: UserRole[]) {
  const sessionCookie = (await cookies()).get("weather-decision-auth")?.value;
  if (!sessionCookie) {
    return redirectToLogin();
  }

  await connection();
  const decoded = await adminAuth
    .verifySessionCookie(sessionCookie, true)
    .catch(() => redirectToLogin());

  if (allowedRoles) {
    const userSnapshot = await adminDb
      .collection("users")
      .doc(decoded.uid)
      .get();
    const role = userSnapshot.data()?.role as UserRole | undefined;
    if (!userSnapshot.exists || !canAccessRole(role, allowedRoles)) {
      redirect("/");
    }
  }

  return decoded;
}
