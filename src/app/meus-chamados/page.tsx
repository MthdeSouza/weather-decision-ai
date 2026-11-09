"use client";

import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";

import { TicketForm } from "@/components/TicketForm";
import { TicketList } from "@/components/TicketList";
import { TICKET_STATUS_LABELS } from "@/constants/tickets";
import { auth } from "@/services/firebase/config";
import { getCurrentAuthUser, getMyTickets } from "@/services/tickets";
import type { Ticket, TicketStatus } from "@/types/ticket";

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | TicketStatus>("all");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadTickets = async () => {
    setLoading(true);
    const nextTickets = await getMyTickets();
    setTickets(nextTickets);
    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setIsAuthenticated(false);
        setUserName("");
        setTickets([]);
        setLoading(false);
        return;
      }

      setIsAuthenticated(true);
      const user = await getCurrentAuthUser();
      setUserName(user?.name ?? currentUser.displayName ?? "Usuário");
      await loadTickets();
    });

    return () => unsubscribe();
  }, []);

  const filteredTickets = useMemo(() => {
    if (statusFilter === "all") {
      return tickets;
    }

    return tickets.filter((ticket) => ticket.status === statusFilter);
  }, [statusFilter, tickets]);

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-100 px-6 py-10 dark:bg-slate-950">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
            Acesso obrigatório
          </p>
          <h1 className="mt-4 text-3xl font-bold text-slate-900 dark:text-slate-50">
            Faça login para continuar
          </h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            Só é possível visualizar e abrir chamados quando o usuário está
            autenticado.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <section className="flex flex-col mx-auto max-w-7xl px-4 py-8 gap-8">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
              MINHA ÁREA
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-50">
              Meus Chamados
            </h1>
          </div>
        </header>
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {/* <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
            Minha área
          </p> */}
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            {/* <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
                Meus chamados
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Usuário: {userName}
              </p>
            </div> */}

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Abrir chamado
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
              Chamados cadastrados
            </h2>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "all" | TicketStatus)
              }
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="all">Todos os status</option>
              {Object.entries(TICKET_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <TicketList
            loading={loading}
            tickets={filteredTickets}
            emptyTitle="Nenhum chamado encontrado"
            emptyDescription="Ainda não há chamados neste filtro. Clique em “Abrir chamado” para começar."
          />
        </section>
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
                Abrir chamado
              </h3>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
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
