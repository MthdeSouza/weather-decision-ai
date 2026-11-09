"use client";

import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";

import { BrazilWeatherMap } from "@/components/BrazilWeatherMap";
import { auth } from "@/services/firebase/config";
import {
  getCurrentAuthUser,
  getPendingApprovalTickets,
} from "@/services/tickets";
import type { UserRole } from "@/types/user";

export default function HomePage() {
  const [role, setRole] = useState<UserRole>("basic");
  const [pendingApprovalCount, setPendingApprovalCount] = useState<
    number | null
  >(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setRole("basic");
        setPendingApprovalCount(null);
        return;
      }

      const profile = await getCurrentAuthUser();
      const nextRole = (profile?.role ?? "basic") as UserRole;
      setRole(nextRole);

      if (nextRole === "approver" || nextRole === "admin") {
        const tickets = await getPendingApprovalTickets();
        setPendingApprovalCount(tickets.length);
        return;
      }

      setPendingApprovalCount(null);
    });

    return () => unsubscribe();
  }, []);

  const canSeePendingApproval = role === "approver" || role === "admin";

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <section className="flex flex-col mx-auto max-w-7xl px-4 py-8 gap-8">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
              Brasil em tempo real
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-50">
              Dashboard
            </h1>
          </div>
        </header>
        {canSeePendingApproval ? (
          <div className="mx-auto max-w-6xl px-4 pb-0 w-full">
            <div className="flex items-center justify-between rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 shadow-sm dark:border-sky-900 dark:bg-sky-950/40">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 dark:text-sky-300">
                  Aprovação
                </p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                  Chamados aguardando análise
                </p>
              </div>
              <div className="text-3xl font-bold text-sky-700 dark:text-sky-300">
                {pendingApprovalCount ?? 0}
              </div>
            </div>
          </div>
        ) : null}

        <BrazilWeatherMap />
      </section>
    </main>
  );
}
