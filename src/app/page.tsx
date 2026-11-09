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
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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
            </div>

            <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                  Chamados
                </h2>

                <div className="mt-4 space-y-3">
                  {tickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className={[
                        "w-full rounded-2xl border p-3 text-left transition",
                        selectedTicket?.id === ticket.id
                          ? "border-sky-500 bg-sky-50 dark:border-sky-400 dark:bg-sky-500/5"
                          : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                          #{ticket.id.slice(0, 8)}
                        </p>
                        <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                          {ticket.status}
                        </span>
                      </div>
                      <p className="mt-2 font-medium text-slate-900 dark:text-slate-50">
                        {ticket.construction.city} / {ticket.construction.state}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(ticket.createdAt)}
                      </p>
                    </button>
                  ))}
                </div>
              </aside>

              <div className="space-y-6">
                {selectedTicket ? (
                  <>
                    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">
                            Chamado selecionado
                          </p>
                          <h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">
                            {selectedTicket.construction.city} /{" "}
                            {selectedTicket.construction.state}
                          </h2>
                        </div>
                        <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                          {selectedTicket.status}
                        </span>
                      </div>

                      {selectedTicket.status === "processing" ? (
                        <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-700 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200">
                          Processamento em andamento. A IA está avaliando clima,
                          riscos e cenários do projeto.
                        </div>
                      ) : null}

                      {selectedTicket.status === "failed" ? (
                        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                          A análise falhou. Os diagnósticos de processamento
                          foram registrados no backend sem expor dados
                          sensíveis.
                        </div>
                      ) : null}
                    </div>

                    {reportData ? (
                      <>
                        <div className="grid gap-4 xl:grid-cols-2">
                          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">
                              Dados históricos
                            </p>
                            <h3 className="mt-3 text-xl font-bold text-slate-900 dark:text-slate-50">
                              Indicadores climáticos do período
                            </h3>
                            {climateBars.length > 0 ? (
                              <div className="mt-4 space-y-4">
                                <BarChart
                                  title="Histórico"
                                  items={climateBars}
                                  maxValue={Math.max(
                                    ...climateBars.map((item) => item.value),
                                    1,
                                  )}
                                />
                              </div>
                            ) : (
                              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                                Dados climáticos não disponíveis para este
                                chamado.
                              </p>
                            )}
                          </div>

                          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">
                              IA + recomendações
                            </p>
                            <h3 className="mt-3 text-xl font-bold text-slate-900 dark:text-slate-50">
                              Resumo executivo
                            </h3>
                            <p className="mt-4 text-sm leading-7 text-slate-700 dark:text-slate-200">
                              {String(
                                reportData.executiveSummary ??
                                  "Sem resumo disponível.",
                              )}
                            </p>
                            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                              Recomendações geradas pela IA exigem validação
                              profissional antes de virar decisão final.
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">
                          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                              Informações da obra
                            </h3>
                            <dl className="mt-4 grid gap-4 sm:grid-cols-2 text-sm text-slate-700 dark:text-slate-200">
                              <div>
                                <dt className="text-slate-500 dark:text-slate-400">
                                  Cidade
                                </dt>
                                <dd className="mt-1 font-medium">
                                  {String(
                                    originalPlan.city ??
                                      selectedTicket.construction.city,
                                  )}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-slate-500 dark:text-slate-400">
                                  Estado
                                </dt>
                                <dd className="mt-1 font-medium">
                                  {String(
                                    originalPlan.state ??
                                      selectedTicket.construction.state,
                                  )}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-slate-500 dark:text-slate-400">
                                  Tipo do imóvel
                                </dt>
                                <dd className="mt-1 font-medium">
                                  {String(
                                    originalPlan.propertyType ??
                                      selectedTicket.construction.propertyType,
                                  )}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-slate-500 dark:text-slate-400">
                                  Tipo de construção
                                </dt>
                                <dd className="mt-1 font-medium">
                                  {String(
                                    originalPlan.constructionType ??
                                      selectedTicket.construction
                                        .constructionType,
                                  )}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-slate-500 dark:text-slate-400">
                                  Área
                                </dt>
                                <dd className="mt-1 font-medium">
                                  {String(
                                    originalPlan.builtArea ??
                                      selectedTicket.construction.builtArea,
                                  )}{" "}
                                  m²
                                </dd>
                              </div>
                              <div>
                                <dt className="text-slate-500 dark:text-slate-400">
                                  Previsão de início
                                </dt>
                                <dd className="mt-1 font-medium">
                                  {String(
                                    originalPlan.startDate ??
                                      selectedTicket.construction.startDate,
                                  )}
                                </dd>
                              </div>
                            </dl>
                          </div>

                          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                              Avaliação climática
                            </h3>
                            <p className="mt-4 text-sm leading-7 text-slate-700 dark:text-slate-200">
                              {String(
                                reportData.climateOverview ??
                                  "Sem avaliação climática disponível.",
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">
                          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                              Riscos por etapa
                            </h3>
                            {stageAnalysis.length > 0 ? (
                              <div className="mt-4 space-y-4">
                                {stageAnalysis.map((stage) => (
                                  <div
                                    key={String(stage.name ?? "-")}
                                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950"
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="font-medium text-slate-900 dark:text-slate-50">
                                        {String(stage.name ?? "-")}
                                      </span>
                                      <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                        {String(stage.riskLevel ?? "medium")}
                                      </span>
                                    </div>
                                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                      {String(stage.summary ?? "-")}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                                Sem estágio de obra avaliado pela IA.
                              </p>
                            )}
                          </div>

                          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                              Comparação dos cenários
                            </h3>
                            {scenarioBars.length > 0 ? (
                              <div className="mt-4">
                                <BarChart
                                  title="Cenários por mês"
                                  items={scenarioBars}
                                  maxValue={Math.max(
                                    ...scenarioBars.map((item) => item.value),
                                    1,
                                  )}
                                />
                              </div>
                            ) : (
                              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                                Sem comparação de cenários disponível.
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">
                          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                              Data recomendada e justificativa
                            </h3>
                            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                              {recommendedScenario ? (
                                <>
                                  <div className="font-semibold">
                                    {String(
                                      recommendedScenario.startMonth ?? "-",
                                    )}
                                  </div>
                                  <p className="mt-2">
                                    {String(
                                      recommendedScenario.rationale ??
                                        "Sem justificativa detalhada.",
                                    )}
                                  </p>
                                </>
                              ) : (
                                <p>
                                  Sem recomendação objetiva disponível para a
                                  data de início.
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                              Exposição climática por etapa
                            </h3>
                            {stageBars.length > 0 ? (
                              <div className="mt-4">
                                <BarChart
                                  title="Sensibilidade"
                                  items={stageBars}
                                  maxValue={Math.max(
                                    ...stageBars.map((item) => item.value),
                                    1,
                                  )}
                                />
                              </div>
                            ) : (
                              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                                Sem dados consolidados por etapa.
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">
                          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                              Recomendações de otimização
                            </h3>
                            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-200">
                              {recommendations.length > 0 ? (
                                recommendations.map((recommendation) => (
                                  <li key={recommendation}>{recommendation}</li>
                                ))
                              ) : (
                                <li>Sem recomendações detalhadas.</li>
                              )}
                            </ul>
                          </div>

                          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                              Alternativas construtivas
                            </h3>
                            <div className="mt-4 space-y-3">
                              {constructionAlternatives.length > 0 ? (
                                constructionAlternatives.map((alternative) => (
                                  <div
                                    key={String(
                                      alternative.title ?? "Alternativa",
                                    )}
                                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950"
                                  >
                                    <p className="font-medium text-slate-900 dark:text-slate-50">
                                      {String(alternative.title ?? "-")}
                                    </p>
                                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                      {String(alternative.description ?? "-")}
                                    </p>
                                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                      {alternative.validationRequired
                                        ? "Validação profissional obrigatória"
                                        : "Validação recomendada"}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                  Sem alternativas construtivas disponíveis.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">
                          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                              Limitações da análise
                            </h3>
                            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-200">
                              {limitations.length > 0 ? (
                                limitations.map((limitation) => (
                                  <li key={limitation}>{limitation}</li>
                                ))
                              ) : (
                                <li>Sem limitações identificadas.</li>
                              )}
                            </ul>
                          </div>

                          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                              Fontes de dados
                            </h3>
                            <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                              {dataSources.length > 0 ? (
                                dataSources.map((source) => (
                                  <li
                                    key={source}
                                    className="rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950"
                                  >
                                    {source}
                                  </li>
                                ))
                              ) : (
                                <li>Sem fontes cadastradas.</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
                        <p className="text-xl font-semibold text-slate-900 dark:text-slate-50">
                          Aguardando relatório da IA
                        </p>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                          O chamado foi registrado, mas ainda não há análise
                          climatológica concluída.
                        </p>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>

            <BrazilWeatherMap />
          </>
        )}
      </section>
    </main>
  );
}
