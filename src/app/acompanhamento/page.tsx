"use client";

import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";

import { TicketStatusBadge } from "@/components/TicketStatusBadge";
import { auth } from "@/services/firebase/config";
import {
  filterAndSortTickets,
  getAllTicketsForReview,
  getCurrentAuthUser,
} from "@/services/tickets";
import type { Ticket, TicketStatus } from "@/types/ticket";
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

const RESTARTABLE_ANALYSIS_STATUSES = new Set([
  "failed",
  "pending_ai_analysis",
  "completed",
]);

export default function TicketTrackingPage() {
  const [role, setRole] = useState<UserRole>("basic");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "oldest" | "status" | "user">(
    "recent",
  );
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [processingTicketIds, setProcessingTicketIds] = useState<string[]>([]);
  const [confirmAction, setConfirmAction] = useState<null | {
    type: "restart" | "archive";
    ticketId: string;
    ticketLabel: string;
  }>();
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);

  const loadTickets = async () => {
    setLoading(true);

    try {
      const nextTickets = await getAllTicketsForReview();
      setTickets(nextTickets);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setRole("basic");
        setIsAuthorized(false);
        setTickets([]);
        setLoading(false);
        return;
      }

      const profile = await getCurrentAuthUser();
      const currentRole = (profile?.role ?? "basic") as UserRole;
      setRole(currentRole);

      const isPrivileged =
        currentRole === "approver" || currentRole === "admin";
      setIsAuthorized(isPrivileged);

      if (isPrivileged) {
        await loadTickets();
      }
    });

    return () => unsubscribe();
  }, []);

  const userOptions = useMemo(
    () =>
      Array.from(
        new Map(
          tickets.map((ticket) => [
            ticket.createdBy.uid,
            {
              uid: ticket.createdBy.uid,
              name: ticket.createdBy.name,
            },
          ]),
        ).values(),
      ),
    [tickets],
  );

  const handleRestartAnalysis = async (ticketId: string) => {
    const currentUser = auth.currentUser;
    const token = currentUser ? await currentUser.getIdToken() : null;

    if (!token) {
      window.alert("Sessão do usuário indisponível para reiniciar a análise.");
      return;
    }

    try {
      setProcessingTicketIds((previous) => [...previous, ticketId]);
      setIsConfirmingAction(true);

      const response = await fetch(`/api/tickets/${ticketId}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(
          payload.error ?? "Não foi possível reiniciar a análise.",
        );
      }

      await loadTickets();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Não foi possível reiniciar a análise.",
      );
    } finally {
      setProcessingTicketIds((previous) =>
        previous.filter((id) => id !== ticketId),
      );
      setIsConfirmingAction(false);
      setConfirmAction(null);
    }
  };

  const handleArchiveTicket = async (ticketId: string) => {
    const currentUser = auth.currentUser;
    const token = currentUser ? await currentUser.getIdToken() : null;

    if (!token) {
      window.alert("Sessão do usuário indisponível para arquivar o chamado.");
      return;
    }

    try {
      setIsConfirmingAction(true);

      const response = await fetch(`/api/tickets/${ticketId}/archive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(
          payload.error ?? "Não foi possível arquivar o chamado.",
        );
      }

      await loadTickets();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Não foi possível arquivar o chamado.",
      );
    } finally {
      setIsConfirmingAction(false);
      setConfirmAction(null);
    }
  };

  const visibleTickets = useMemo(
    () =>
      filterAndSortTickets({
        tickets,
        status: statusFilter,
        userId: userFilter,
        fromDate,
        toDate,
        sortBy,
      }),
    [fromDate, sortBy, statusFilter, tickets, toDate, userFilter],
  );

  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-slate-100 px-6 py-10 dark:bg-slate-950">
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
            Acesso restrito
          </p>
          <h1 className="mt-4 text-3xl font-bold text-slate-900 dark:text-slate-50">
            Gerenciamento de chamados
          </h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            Apenas approver e admin podem acompanhar e reprocessar todos os
            tickets.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
            Operação
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-50">
            Gerenciamento de chamados
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Perfil atual:{" "}
            <span className="font-semibold capitalize">{role}</span>
          </p>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as TicketStatus | "all")
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="all">Todos</option>
                <option value="pending_approval">Aguardando aprovação</option>
                <option value="pending_ai_analysis">Aguardando IA</option>
                <option value="processing">Em processamento</option>
                <option value="completed">Concluído</option>
                <option value="failed">Falhou</option>
                <option value="rejected">Reprovado</option>
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <span>Usuário</span>
              <select
                value={userFilter}
                onChange={(event) => setUserFilter(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="all">Todos</option>
                {userOptions.map((user) => (
                  <option key={user.uid} value={user.uid}>
                    {user.name}
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
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <span>Data final</span>
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <span>Ordenar por</span>
              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(
                    event.target.value as
                      | "recent"
                      | "oldest"
                      | "status"
                      | "user",
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="recent">Mais recentes</option>
                <option value="oldest">Mais antigos</option>
                <option value="status">Status</option>
                <option value="user">Usuário</option>
              </select>
            </label>
          </div>
        </section>

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Carregando tickets...
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                Tickets ({visibleTickets.length})
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                  <tr>
                    <th className="px-5 py-3 font-medium">Ticket</th>
                    <th className="px-5 py-3 font-medium">Solicitante</th>
                    <th className="px-5 py-3 font-medium">Local</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Criação</th>
                    <th className="px-5 py-3 font-medium">Início da obra</th>
                    <th className="px-5 py-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTickets.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-10 text-center text-slate-500 dark:text-slate-400"
                      >
                        Nenhum ticket encontrado com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    visibleTickets.map((ticket) => (
                      <tr
                        key={ticket.id}
                        className="border-t border-slate-200 dark:border-slate-800"
                      >
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-900 dark:text-slate-50">
                            #{ticket.id.slice(0, 8)}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {ticket.construction.propertyType}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-900 dark:text-slate-50">
                            {ticket.createdBy.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {ticket.createdBy.email}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-700 dark:text-slate-200">
                          <div>{ticket.construction.city}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {ticket.construction.state}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <TicketStatusBadge status={ticket.status} />
                        </td>
                        <td className="px-5 py-4 text-slate-700 dark:text-slate-200">
                          {formatDate(ticket.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-slate-700 dark:text-slate-200">
                          {formatDate(ticket.construction.startDate)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {RESTARTABLE_ANALYSIS_STATUSES.has(
                              ticket.status,
                            ) ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmAction({
                                    type: "restart",
                                    ticketId: ticket.id,
                                    ticketLabel: `#${ticket.id.slice(0, 8)}`,
                                  })
                                }
                                disabled={processingTicketIds.includes(
                                  ticket.id,
                                )}
                                title={
                                  processingTicketIds.includes(ticket.id)
                                    ? "Processando análise..."
                                    : "Reiniciar análise da IA"
                                }
                                aria-label="Reiniciar análise da IA"
                                className="cursor-pointer inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20 dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                              >
                                {processingTicketIds.includes(ticket.id) ? (
                                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-700 border-t-transparent dark:border-sky-300 dark:border-t-transparent" />
                                ) : (
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  >
                                    <path d="M3 12a9 9 0 1 0 3-6.7" />
                                    <path d="M3 4v5h5" />
                                    <path d="M12 7v5l3 2" />
                                  </svg>
                                )}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                —
                              </span>
                            )}

                            {ticket.status !== "archived" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmAction({
                                    type: "archive",
                                    ticketId: ticket.id,
                                    ticketLabel: `#${ticket.id.slice(0, 8)}`,
                                  })
                                }
                                title="Arquivar chamado"
                                aria-label="Arquivar chamado"
                                className="cursor-pointer inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                >
                                  <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z" />
                                  <path d="M9 9h6" />
                                  <path d="M8 5v4h8V5" />
                                </svg>
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {confirmAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
              Confirmar ação
            </h3>

            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {confirmAction.type === "restart"
                ? `Deseja reiniciar a análise da IA para o ticket ${confirmAction.ticketLabel}?`
                : `Deseja arquivar o ticket ${confirmAction.ticketLabel}? Esta ação oculta o chamado de todas as views normais.`}
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={isConfirmingAction}
                className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isConfirmingAction) {
                    return;
                  }

                  if (confirmAction.type === "restart") {
                    void handleRestartAnalysis(confirmAction.ticketId);
                    return;
                  }

                  void handleArchiveTicket(confirmAction.ticketId);
                }}
                disabled={isConfirmingAction}
                className={
                  confirmAction.type === "restart"
                    ? "cursor-pointer rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
                    : "cursor-pointer rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                }
              >
                {isConfirmingAction ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {confirmAction.type === "restart"
                      ? "Reiniciando..."
                      : "Arquivando..."}
                  </span>
                ) : confirmAction.type === "restart" ? (
                  "Reiniciar"
                ) : (
                  "Arquivar"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
