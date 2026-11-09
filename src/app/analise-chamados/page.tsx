"use client";

import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";

import { TicketStatusBadge } from "@/components/TicketStatusBadge";
import {
  CONSTRUCTION_TYPES,
  PROPERTY_TYPES,
  TICKET_STATUS_LABELS,
} from "@/constants/tickets";
import { auth } from "@/services/firebase/config";
import {
  getCurrentAuthUser,
  getPendingApprovalTickets,
  rejectTicket,
} from "@/services/tickets";
import type { Ticket } from "@/types/ticket";

const formatDate = (value: unknown) => {
  if (!value) {
    return "-";
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().toLocaleString("pt-BR");
  }

  return new Date(String(value)).toLocaleString("pt-BR");
};

const getPropertyLabel = (value?: string) =>
  PROPERTY_TYPES.find((item) => item.value === value)?.label ?? value ?? "-";

const getConstructionLabel = (value?: string) =>
  CONSTRUCTION_TYPES.find((item) => item.value === value)?.label ??
  value ??
  "-";

export default function AnalysisPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [role, setRole] = useState<"basic" | "approver" | "admin">("basic");
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const loadTickets = async () => {
    setLoading(true);
    const nextTickets = await getPendingApprovalTickets();
    setTickets(nextTickets);
    if (!nextTickets.some((ticket) => ticket.id === selectedTicketId)) {
      setSelectedTicketId(nextTickets[0]?.id ?? null);
    }
    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setIsAuthorized(false);
        setRole("basic");
        setTickets([]);
        setLoading(false);
        return;
      }

      const user = await getCurrentAuthUser();
      const nextRole = user?.role ?? "basic";
      setRole(nextRole);
      setIsAuthorized(nextRole === "approver" || nextRole === "admin");

      if (nextRole === "approver" || nextRole === "admin") {
        await loadTickets();
      }
    });

    return () => unsubscribe();
  }, []);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [selectedTicketId, tickets],
  );

  const handleApprove = async (ticketId: string) => {
    const confirmed = window.confirm(
      "Deseja aprovar este chamado para análise da IA?",
    );
    if (!confirmed) {
      return;
    }

    const reviewer = await getCurrentAuthUser();
    if (!reviewer) {
      return;
    }

    const currentToken = await auth.currentUser?.getIdToken();
    if (!currentToken) {
      window.alert("Sessão do usuário indisponível para aprovar o chamado.");
      return;
    }

    const response = await fetch("/api/tickets/approve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentToken}`,
      },
      body: JSON.stringify({
        ticketId,
        reviewer: {
          uid: reviewer.uid,
          name: reviewer.name,
          email: reviewer.email,
        },
      }),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      window.alert(payload.error ?? "Não foi possível aprovar o chamado.");
      return;
    }

    await loadTickets();
  };

  const handleReject = async (ticketId: string) => {
    const reason = window.prompt("Digite a justificativa da reprovação:", "");
    if (!reason || !reason.trim()) {
      window.alert("A justificativa é obrigatória para reprovar o chamado.");
      return;
    }

    const reviewer = await getCurrentAuthUser();
    if (!reviewer) {
      return;
    }

    await rejectTicket(
      ticketId,
      {
        uid: reviewer.uid,
        name: reviewer.name,
        email: reviewer.email,
      },
      reason.trim(),
    );

    await loadTickets();
  };

  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-slate-100 px-6 py-10 dark:bg-slate-950">
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
            Acesso restrito
          </p>
          <h1 className="mt-4 text-3xl font-bold text-slate-900 dark:text-slate-50">
            Sem permissão para análise
          </h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            Apenas usuários com perfil approver ou admin podem acessar a fila de
            análise de chamados.
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
            Aprovação
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-50">
            Análise de chamados
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Perfil atual:{" "}
            <span className="font-semibold capitalize">{role}</span>
          </p>
        </header>

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Carregando fila de aprovação...
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xl font-semibold text-slate-900 dark:text-slate-50">
              Nenhum chamado pendente
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              A fila de aprovação está vazia no momento.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
            <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                Fila de aprovação
              </h2>

              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={[
                      "w-full rounded-2xl border p-4 text-left transition",
                      selectedTicketId === ticket.id
                        ? "border-sky-500 bg-sky-50 dark:border-sky-400 dark:bg-sky-500/5"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                          #{ticket.id.slice(0, 8)}
                        </p>
                        <p className="mt-1 font-medium text-slate-900 dark:text-slate-50">
                          {ticket.createdBy.name}
                        </p>
                      </div>
                      <TicketStatusBadge status={ticket.status} />
                    </div>
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                      {ticket.construction.city} / {ticket.construction.state}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {getPropertyLabel(
                        ticket.construction.propertyType ??
                          ticket.construction.type,
                      )}{" "}
                      •{" "}
                      {getConstructionLabel(
                        ticket.construction.constructionType,
                      )}{" "}
                      • {ticket.construction.estimatedMonths} meses
                    </p>
                  </button>
                ))}
              </div>
            </aside>

            {selectedTicket ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Detalhes do chamado
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">
                      #{selectedTicket.id.slice(0, 8)}
                    </h2>
                  </div>
                  <TicketStatusBadge status={selectedTicket.status} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Solicitante
                    </p>
                    <p className="mt-2 font-semibold text-slate-900 dark:text-slate-50">
                      {selectedTicket.createdBy.name}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {selectedTicket.createdBy.email}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Localização
                    </p>
                    <p className="mt-2 font-semibold text-slate-900 dark:text-slate-50">
                      {selectedTicket.construction.city} /{" "}
                      {selectedTicket.construction.state}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {getPropertyLabel(
                        selectedTicket.construction.propertyType ??
                          selectedTicket.construction.type,
                      )}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {getConstructionLabel(
                        selectedTicket.construction.constructionType,
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Início da obra
                    </p>
                    <p className="mt-2 font-semibold text-slate-900 dark:text-slate-50">
                      {selectedTicket.construction.startDate
                        ? new Date(
                            `${selectedTicket.construction.startDate}T00:00:00`,
                          ).toLocaleDateString("pt-BR")
                        : "-"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Prazo
                    </p>
                    <p className="mt-2 font-semibold text-slate-900 dark:text-slate-50">
                      {selectedTicket.construction.estimatedMonths} meses
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Área
                    </p>
                    <p className="mt-2 font-semibold text-slate-900 dark:text-slate-50">
                      {selectedTicket.construction.builtArea} m²
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Abertura
                    </p>
                    <p className="mt-2 font-semibold text-slate-900 dark:text-slate-50">
                      {formatDate(selectedTicket.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    Status do chamado
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
                    {TICKET_STATUS_LABELS[selectedTicket.status]}
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleApprove(selectedTicket.id)}
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(selectedTicket.id)}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
                  >
                    Reprovar
                  </button>
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
