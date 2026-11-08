"use client";

import {
  TICKET_STATUS_LABELS,
  TICKET_STATUS_STYLES,
} from "@/constants/tickets";
import type { TicketStatus } from "@/types/ticket";

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${TICKET_STATUS_STYLES[status]}`}
    >
      {TICKET_STATUS_LABELS[status]}
    </span>
  );
}
