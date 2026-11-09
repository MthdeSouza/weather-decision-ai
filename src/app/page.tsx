"use client";

import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";

import { BrazilWeatherMap } from "@/components/BrazilWeatherMap";
import { auth } from "@/services/firebase/config";
import {
  calculateTicketDashboardStats,
  emptyTicketDashboardStats,
  getCurrentAuthUser,
  getDashboardTickets,
  type TicketDashboardStats,
} from "@/services/tickets";
import type { Ticket } from "@/types/ticket";
import type { UserRole } from "@/types/user";

const formatDate = (value: unknown) => {
  if (!value) {
    return "-";
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? value
      : parsed.toLocaleDateString("pt-BR");
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date })
      .toDate()
      .toLocaleDateString("pt-BR");
  }

  return new Date(String(value)).toLocaleDateString("pt-BR");
};

const safeParseReport = (ticket: Ticket | null) => {
  if (!ticket) {
    return null;
  }

  if (
    ticket.aiAnalysisMeta?.result &&
    typeof ticket.aiAnalysisMeta.result === "object"
  ) {
    return ticket.aiAnalysisMeta.result as Record<string, unknown>;
  }

  if (!ticket.iaAnalysis?.trim()) {
    return null;
  }

  try {
    return JSON.parse(ticket.iaAnalysis) as Record<string, unknown>;
  } catch {
    return null;
  }
};

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

function BarChart({
  title,
  items,
  maxValue,
}: {
  title: string;
  items: Array<{
    label: string;
    value: number;
    unit?: string;
    colorClass: string;
  }>;
  maxValue?: number;
}) {
  const factor = maxValue ?? Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-300">
        {title}
      </h3>

      <div className="mt-4 space-y-4">
        {items.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
              <span>{item.label}</span>
              <span>
                {item.value}
                {item.unit ?? ""}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className={`h-full rounded-full ${item.colorClass}`}
                style={{
                  width: `${Math.max(8, (item.value / factor) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [role, setRole] = useState<UserRole>("basic");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<TicketDashboardStats>(
    emptyTicketDashboardStats,
  );
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const nextTickets = await getDashboardTickets();
      setTickets(nextTickets);
      setStats(calculateTicketDashboardStats(nextTickets));
      setSelectedTicketId(
        nextTickets.find((ticket) => ticket.status === "completed")?.id ??
          nextTickets[0]?.id ??
          null,
      );
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
        setTickets([]);
        setStats(emptyTicketDashboardStats);
        setSelectedTicketId(null);
        setError(null);
        setLoading(false);
        return;
      }

      const profile = await getCurrentAuthUser();
      setRole((profile?.role ?? "basic") as UserRole);
      await loadDashboard();
    });

    return () => unsubscribe();
  }, []);

  const selectedTicket = useMemo(
    () =>
      tickets.find((ticket) => ticket.id === selectedTicketId) ??
      tickets[0] ??
      null,
    [selectedTicketId, tickets],
  );

  const reportData = useMemo(
    () => safeParseReport(selectedTicket),
    [selectedTicket],
  );

  const originalPlan = (reportData?.originalPlan ?? {}) as Record<
    string,
    unknown
  >;
  const stageAnalysis = Array.isArray(reportData?.stageAnalysis)
    ? (reportData?.stageAnalysis as Array<Record<string, unknown>>)
    : [];
  const constructionAlternatives = Array.isArray(
    reportData?.constructionAlternatives,
  )
    ? (reportData?.constructionAlternatives as Array<Record<string, unknown>>)
    : [];
  const recommendations = Array.isArray(reportData?.recommendations)
    ? (reportData?.recommendations as string[])
    : [];
  const limitations = Array.isArray(reportData?.limitations)
    ? (reportData?.limitations as string[])
    : [];
  const dataSources = Array.isArray(reportData?.dataSources)
    ? (reportData?.dataSources as string[])
    : [];

  const climateSummary = selectedTicket?.climateContext?.summary;
  const climateBars = climateSummary
    ? [
        {
          label: "Precipitação",
          value: Number(climateSummary.precipitationAverageMm ?? 0),
          unit: "mm",
          colorClass: "bg-sky-500",
        },
        {
          label: "Temperatura",
          value: Number(climateSummary.averageTemperatureC ?? 0),
          unit: "°C",
          colorClass: "bg-amber-500",
        },
        {
          label: "Umidade",
          value: Number(climateSummary.averageHumidityPercent ?? 0),
          unit: "%",
          colorClass: "bg-emerald-500",
        },
        {
          label: "Rajadas",
          value: Number(climateSummary.strongGustDays ?? 0),
          unit: "dias",
          colorClass: "bg-violet-500",
        },
      ]
    : [];

  const scenarioBars = Array.isArray(reportData?.alternativeStartDates)
    ? (reportData?.alternativeStartDates as Array<Record<string, unknown>>).map(
        (item) => ({
          label: String(item.startMonth ?? "-"),
          value: Number(item.score ?? 0),
          unit: " pts",
          colorClass: "bg-cyan-500",
        }),
      )
    : [];

  const stageBars = Array.isArray(reportData?.stageAnalysis)
    ? (reportData?.stageAnalysis as Array<Record<string, unknown>>).map(
        (item) => ({
          label: String(item.name ?? "-"),
          value: Number(item.climateSensitivity ?? 0),
          unit: "x",
          colorClass:
            Number(item.climateSensitivity ?? 0) > 1.2
              ? "bg-rose-500"
              : Number(item.climateSensitivity ?? 0) > 0.8
                ? "bg-amber-500"
                : "bg-emerald-500",
        }),
      )
    : [];

  const recommendedScenario = Array.isArray(reportData?.alternativeStartDates)
    ? (
        reportData?.alternativeStartDates as Array<Record<string, unknown>>
      ).sort((a, b) => Number(a.score ?? 0) - Number(b.score ?? 0))[0]
    : null;

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

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            Carregando dashboard e relatórios...
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xl font-semibold text-slate-900 dark:text-slate-50">
              Nenhum chamado disponível
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Ainda não há dados para este usuário ou perfil.
            </p>
          </div>
        ) : (
          <>
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

            <BrazilWeatherMap />
          </>
        )}
      </section>
    </main>
  );
}
