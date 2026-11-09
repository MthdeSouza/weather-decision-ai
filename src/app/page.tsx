"use client";

import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";

import { BrazilWeatherMap } from "@/components/BrazilWeatherMap";
import { auth } from "@/services/firebase/config";
import {
  calculateTicketDashboardStats,
  emptyTicketDashboardStats,
  getCurrentAuthUser,
  getDashboardTickets,
  type TicketDashboardStats,
} from "@/services/tickets";
import type { UserRole } from "@/types/user";

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <span className={`text-3xl font-bold ${accent}`}>{value}</span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [role, setRole] = useState<UserRole>("basic");
  const [stats, setStats] = useState<TicketDashboardStats>(
    emptyTicketDashboardStats,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const nextTickets = await getDashboardTickets();
      setStats(calculateTicketDashboardStats(nextTickets));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar o dashboard.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setRole("basic");
        setStats(emptyTicketDashboardStats);
        setError(null);
        setLoading(false);
        return;
      }

      try {
        const profile = await getCurrentAuthUser();
        const currentRole = (profile?.role ?? "basic") as UserRole;
        setRole(currentRole);
        if (currentRole === "approver" || currentRole === "admin") {
          await loadDashboard();
        } else {
          setStats(emptyTicketDashboardStats);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar o dashboard.",
        );
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <section className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8">
        <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
              Brasil em tempo real
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-50">
              Dashboard
            </h1>
          </div>

          {role !== "basic" ? (
            <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
              Perfil: {role}
            </div>
          ) : null}
        </header>

        {loading && (role === "admin" || role === "approver") ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            Carregando dashboard e relatórios...
          </div>
        ) : error && (role === "admin" || role === "approver") ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        ) : (
          <>
            {role === "admin" || role === "approver" ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
              <StatCard
                label="Total"
                value={stats.total}
                accent="text-slate-900 dark:text-slate-50"
              />
              <StatCard
                label="Pendentes"
                value={stats.pendingApproval}
                accent="text-amber-600 dark:text-amber-300"
              />
              <StatCard
                label="Aguardando IA"
                value={stats.pendingAiAnalysis}
                accent="text-sky-600 dark:text-sky-300"
              />
              <StatCard
                label="Em processamento"
                value={stats.processing}
                accent="text-violet-600 dark:text-violet-300"
              />
              <StatCard
                label="Concluídos"
                value={stats.completed}
                accent="text-emerald-600 dark:text-emerald-300"
              />
              <StatCard
                label="Falhas"
                value={stats.failed}
                accent="text-rose-600 dark:text-rose-300"
              />
              <StatCard
                label="Rejeitados"
                value={stats.rejected}
                accent="text-rose-600 dark:text-rose-300"
              />
              </div>
            ) : null}

            <BrazilWeatherMap />
          </>
        )}
      </section>
    </main>
  );
}
