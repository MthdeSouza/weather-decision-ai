import type { Ticket, TicketStatus } from "@/types/ticket";

export type TicketSortOption = "recent" | "oldest" | "status" | "user";

export type TicketFilterOptions = {
  tickets: Ticket[];
  status?: TicketStatus | "all";
  userId?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: TicketSortOption;
};

const getTicketDateValue = (ticket: Ticket) => {
  if (ticket.createdAt && typeof ticket.createdAt === "object") {
    if ("toDate" in ticket.createdAt) {
      return new Date(ticket.createdAt.toDate()).getTime();
    }

    if ("seconds" in ticket.createdAt) {
      return new Date(
        (ticket.createdAt as { seconds: number }).seconds * 1000,
      ).getTime();
    }
  }

  const fallback = ticket.construction?.startDate
    ? new Date(`${ticket.construction.startDate}T00:00:00`).getTime()
    : 0;

  return Number.isFinite(fallback) ? fallback : 0;
};

const matchesDateRange = (
  ticket: Ticket,
  fromDate?: string,
  toDate?: string,
) => {
  const timestamp = getTicketDateValue(ticket);

  if (!fromDate && !toDate) {
    return true;
  }

  const from = fromDate
    ? new Date(`${fromDate}T00:00:00`).getTime()
    : Number.NEGATIVE_INFINITY;
  const to = toDate
    ? new Date(`${toDate}T23:59:59`).getTime()
    : Number.POSITIVE_INFINITY;

  return timestamp >= from && timestamp <= to;
};

const statusPriority: Record<TicketStatus, number> = {
  pending_approval: 0,
  pending_ai_analysis: 1,
  processing: 2,
  completed: 3,
  failed: 4,
  rejected: 5,
  archived: 6,
};

export function filterAndSortTickets({
  tickets,
  status = "all",
  userId = "all",
  fromDate = "",
  toDate = "",
  sortBy = "recent",
}: TicketFilterOptions): Ticket[] {
  const filtered = tickets.filter((ticket) => {
    if (ticket.status === "archived") {
      return false;
    }

    const matchesStatus = status === "all" || ticket.status === status;
    const matchesUser =
      userId === "all" || userId === "" || ticket.createdBy.uid === userId;
    const matchesDate = matchesDateRange(ticket, fromDate, toDate);

    return matchesStatus && matchesUser && matchesDate;
  });

  const sorted = [...filtered].sort((left, right) => {
    if (sortBy === "oldest") {
      return getTicketDateValue(left) - getTicketDateValue(right);
    }

    if (sortBy === "status") {
      const statusComparison =
        statusPriority[left.status] - statusPriority[right.status];

      if (statusComparison !== 0) {
        return statusComparison;
      }
    }

    if (sortBy === "user") {
      const userComparison = left.createdBy.name.localeCompare(
        right.createdBy.name,
        "pt-BR",
      );

      if (userComparison !== 0) {
        return userComparison;
      }
    }

    return getTicketDateValue(right) - getTicketDateValue(left);
  });

  return sorted;
}
