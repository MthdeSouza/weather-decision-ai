"use client";

import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";

import { TicketForm } from "@/components/TicketForm";
import { TicketList } from "@/components/TicketList";
import { TICKET_STATUS_LABELS } from "@/constants/tickets";
import { MAX_PENDING_APPROVAL_TICKETS } from "@/lib/ticket-workflow";
import { auth } from "@/services/firebase/config";
import { filterAndSortTickets, getMyTickets } from "@/services/tickets";
import type { Ticket, TicketStatus } from "@/types/ticket";
import { getConstructionLabel, getPropertyLabel } from "@/utils/helpers";

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

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | TicketStatus>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "oldest" | "status">(
    "recent",
  );
  // const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const pendingApprovalCount = tickets.filter(
    (ticket) => ticket.status === "pending_approval",
  ).length;
  const reachedPendingApprovalLimit =
    pendingApprovalCount >= MAX_PENDING_APPROVAL_TICKETS;

  const loadTickets = async () => {
    setLoading(true);
    const nextTickets = await getMyTickets();
    setTickets(nextTickets);
    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        // setIsAuthenticated(false);
        setTickets([]);
        setLoading(false);
        return;
      }

      // setIsAuthenticated(true);
      await loadTickets();
    });

    return () => unsubscribe();
  }, []);

  const filteredTickets = useMemo(
    () =>
      filterAndSortTickets({
        tickets,
        status: statusFilter,
        fromDate,
        toDate,
        sortBy,
      }),
    [fromDate, sortBy, statusFilter, tickets, toDate],
  );

  const selectedTicket = useMemo(
    () =>
      filteredTickets.find((ticket) => ticket.id === selectedTicketId) ??
      filteredTickets[0] ??
      null,
    [filteredTickets, selectedTicketId],
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

  const executiveSummary = reportData?.executiveSummary
    ? String(reportData.executiveSummary)
    : selectedTicket?.iaAnalysis?.trim()
      ? "Relatório em processamento ou não disponível em formato JSON."
      : "Ainda não há análise da IA concluída para este ticket.";

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
          unit: " dias",
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

  // if (!isAuthenticated) {
  //   return (
  //     <main className="min-h-screen bg-slate-100 px-6 py-10 dark:bg-slate-950">
  //       <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
  //         <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
  //           Acesso obrigatório
  //         </p>
  //         <h1 className="mt-4 text-3xl font-bold text-slate-900 dark:text-slate-50">
  //           Faça login para continuar
  //         </h1>
  //         <p className="mt-3 text-slate-600 dark:text-slate-300">
  //           Só é possível visualizar e abrir chamados quando o usuário está
  //           autenticado.
  //         </p>
  //       </div>
  //     </main>
  //   );
  // }

  return (
    <main className="h-full min-h-0 overflow-hidden bg-slate-100 dark:bg-slate-950 ">
      {/* <main className="h-full min-h-0 overflow-hidden bg-slate-100 dark:bg-slate-950"> */}
      <section className="mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-4 overflow-hidden px-4 py-8">
        <header className="flex shrink-0 items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
              MINHA ÁREA
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-50">
              Meus Chamados
            </h1>
          </div>
        </header>
        <section className="shrink-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <label className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                <span>Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as "all" | TicketStatus)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="all">Todos os status</option>
                  {Object.entries(TICKET_STATUS_LABELS)
                    .filter(([key]) => key !== "archived")
                    .map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                <span>Data inicial</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                <span>Data final</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                <span>Ordenar por</span>
                <select
                  value={sortBy}
                  onChange={(event) =>
                    setSortBy(
                      event.target.value as "recent" | "oldest" | "status",
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="recent">Mais recentes</option>
                  <option value="oldest">Mais antigos</option>
                  <option value="status">Status</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                disabled={loading || reachedPendingApprovalLimit}
                title={
                  reachedPendingApprovalLimit
                    ? `Limite de ${MAX_PENDING_APPROVAL_TICKETS} chamados aguardando aprovação atingido`
                    : undefined
                }
                className="cursor-pointer inline-flex items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
              >
                Novo chamado
              </button>
            </div>
            {reachedPendingApprovalLimit ? (
              <p
                role="status"
                className="text-sm text-amber-700 dark:text-amber-300"
              >
                Você tem {pendingApprovalCount} chamados aguardando aprovação.
                Aguarde a análise de pelo menos um antes de abrir outro.
              </p>
            ) : null}
          </div>
        </section>

        <section className="flex min-h-0 flex-1 flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex shrink-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
              Chamados cadastrados
            </h2>
          </div>

          <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:grid-rows-1">
            <div className="min-h-0 min-w-0 overflow-y-auto pr-1">
              <TicketList
                loading={loading}
                tickets={filteredTickets}
                selectedTicketId={selectedTicketId}
                onSelectTicket={setSelectedTicketId}
                emptyTitle="Nenhum chamado encontrado"
                emptyDescription="Ainda não há chamados neste filtro. Clique em “Abrir chamado” para começar."
              />
            </div>

            <div className="min-h-0 min-w-0 overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950">
              {selectedTicket ? (
                <div className="space-y-6">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">
                        Chamado selecionado
                      </p>
                      <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">
                        {selectedTicket.construction.city} /{" "}
                        {selectedTicket.construction.state}
                      </h3>
                    </div>
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      {TICKET_STATUS_LABELS[selectedTicket.status]}
                    </span>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        Imóvel
                      </p>
                      <p className="mt-2 font-medium text-slate-900 dark:text-slate-50">
                        {getPropertyLabel(
                          selectedTicket.construction.propertyType,
                        )}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        Construção
                      </p>
                      <p className="mt-2 font-medium text-slate-900 dark:text-slate-50">
                        {getConstructionLabel(
                          selectedTicket.construction.constructionType,
                        )}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        Início da obra
                      </p>
                      <p className="mt-2 font-medium text-slate-900 dark:text-slate-50">
                        {selectedTicket.construction.startDate
                          ? new Date(
                              `${selectedTicket.construction.startDate}T00:00:00`,
                            ).toLocaleDateString("pt-BR")
                          : "-"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        Área
                      </p>
                      <p className="mt-2 font-medium text-slate-900 dark:text-slate-50">
                        {selectedTicket.construction.builtArea} m²
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/30">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-700 dark:text-sky-300">
                      IA + recomendações
                    </p>
                    <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-200">
                      {executiveSummary}
                    </p>
                  </div>

                  {selectedTicket.status === "processing" ? (
                    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-700 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200">
                      Processamento em andamento. A IA está avaliando clima,
                      riscos e cenários do projeto.
                    </div>
                  ) : null}

                  {selectedTicket.status === "failed" ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                      A análise falhou. Os diagnósticos de processamento foram
                      registrados no backend sem expor dados sensíveis.
                    </div>
                  ) : null}

                  {selectedTicket.approval.rejectionReason ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/30">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">
                        Motivo da rejeição
                      </p>
                      <p className="mt-3 text-sm text-rose-800 dark:text-rose-100">
                        {selectedTicket.approval.rejectionReason}
                      </p>
                    </div>
                  ) : null}

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
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                                <div className="space-y-4">
                                  {climateBars.map((item) => (
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
                                            width: `${Math.max(8, Math.min(100, item.value * 2))}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
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
                                {getPropertyLabel(
                                  String(
                                    originalPlan.propertyType ??
                                      selectedTicket.construction.propertyType,
                                  ),
                                )}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-slate-500 dark:text-slate-400">
                                Tipo de construção
                              </dt>
                              <dd className="mt-1 font-medium">
                                {getConstructionLabel(
                                  String(
                                    originalPlan.constructionType ??
                                      selectedTicket.construction
                                        .constructionType,
                                  ),
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
                            <div className="mt-4 space-y-4">
                              {scenarioBars.map((item) => (
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
                                        width: `${Math.max(8, Math.min(100, item.value * 2))}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}
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
                                Sem recomendação objetiva disponível para a data
                                de início.
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                            Exposição climática por etapa
                          </h3>
                          {stageBars.length > 0 ? (
                            <div className="mt-4 space-y-4">
                              {stageBars.map((item) => (
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
                                        width: `${Math.max(8, Math.min(100, item.value * 20))}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}
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
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                  Selecione um chamado para visualizar os detalhes.
                </div>
              )}
            </div>
          </div>
        </section>
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
                Novo chamado
              </h3>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>

            <div className="p-6">
              <TicketForm
                onCreated={() => {
                  setIsModalOpen(false);
                  void loadTickets();
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
