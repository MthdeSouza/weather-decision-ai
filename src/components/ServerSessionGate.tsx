import { Suspense, type ReactNode } from "react";

import { requireServerSession } from "@/lib/server-session";
import type { UserRole } from "@/types/user";

export function ServerSessionGate({
  children,
  allowedRoles,
}: {
  children: ReactNode;
  allowedRoles?: UserRole[];
}) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          Validando sessão...
        </main>
      }
    >
      <SessionCheck allowedRoles={allowedRoles}>{children}</SessionCheck>
    </Suspense>
  );
}

async function SessionCheck({
  children,
  allowedRoles,
}: {
  children: ReactNode;
  allowedRoles?: UserRole[];
}) {
  await requireServerSession(allowedRoles);
  return children;
}
