"use client";

import { TICKET_STATUS_LABELS } from "@/constants/tickets";
import type { Ticket } from "@/types/ticket";

import {
  formatDate,
  getConstructionLabel,
  getPropertyLabel,
} from "@/utils/helpers";
import { TicketStatusBadge } from "./TicketStatusBadge";

export function TicketList({
  tickets,
  onSelectTicket,
  selectedTicketId,
  emptyTitle,
  emptyDescription,
  loading = false,
}: {
  tickets: Ticket[];
  onSelectTicket?: (ticketId: string) => void;
  selectedTicketId?: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <div className="h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-3 h-7 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="h-12 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-12 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-12 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
        <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          {emptyTitle ?? "Nenhum chamado encontrado"}
        </p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {emptyDescription ?? "Ainda não há registros para esse filtro."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tickets.map((ticket) => {
        const isSelected = selectedTicketId === ticket.id;

        return (
          <button
            key={ticket.id}
            type="button"
            onClick={() => onSelectTicket?.(ticket.id)}
            className={[
              "cursor-pointer w-full rounded-2xl border p-4 text-left transition",
              isSelected
                ? "border-sky-500 bg-sky-50 shadow-sm dark:border-sky-400 dark:bg-sky-500/5"
                : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600",
            ].join(" ")}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  #{ticket.id.slice(0, 8)}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {ticket.construction.city} / {ticket.construction.state}
                </h3>
              </div>

              <TicketStatusBadge status={ticket.status} />
            </div>

            <div className="mt-4 grid gap-3 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-3">
              <div>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  Imóvel:
                </span>
                <div>
                  {getPropertyLabel(
                    ticket.construction.propertyType ??
                      ticket.construction.type,
                  )}
                </div>
              </div>
              <div>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  Construção:
                </span>
                <div>
                  {getConstructionLabel(ticket.construction.constructionType)}
                </div>
              </div>
              <div>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  Início:
                </span>
                <div>
                  {ticket.construction.startDate
                    ? new Date(
                        `${ticket.construction.startDate}T00:00:00`,
                      ).toLocaleDateString("pt-BR")
                    : "-"}
                </div>
              </div>
              <div>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  Prazo:
                </span>
                <div>{ticket.construction.estimatedMonths} meses</div>
              </div>
              <div>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  Área:
                </span>
                <div>{ticket.construction.builtArea} m²</div>
              </div>

              {TICKET_STATUS_LABELS[ticket.status] === "Reprovado" ? (
                <div>
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    Motivo da rejeição:
                  </span>
                  <div>{ticket.approval.rejectionReason || "-"}</div>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span>Aberto em: {formatDate(ticket.createdAt)}</span>
              <span>Última atualização: {formatDate(ticket.updatedAt)}</span>
              <span>{TICKET_STATUS_LABELS[ticket.status]}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
