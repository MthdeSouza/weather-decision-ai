import type { UserRole } from "@/types/user";
import type { TicketStatus } from "@/types/ticket";

const PROCESSABLE_STATUSES: TicketStatus[] = [
  "pending_ai_analysis",
  "rejected",
  "failed",
  "completed",
];

export const PROCESSING_LOCK_TIMEOUT_MS = 15 * 60 * 1000;
export const MAX_PENDING_APPROVAL_TICKETS = 5;

export function canCreatePendingApprovalTicket(currentCount: number) {
  return currentCount < MAX_PENDING_APPROVAL_TICKETS;
}

export function isProcessingRunStale(
  startedAt: unknown,
  now = Date.now(),
) {
  let startedAtMs = Number.NaN;

  if (startedAt instanceof Date) {
    startedAtMs = startedAt.getTime();
  } else if (typeof startedAt === "number") {
    startedAtMs = startedAt;
  } else if (typeof startedAt === "string") {
    startedAtMs = Date.parse(startedAt);
  } else if (typeof startedAt === "object" && startedAt !== null) {
    if ("toMillis" in startedAt && typeof startedAt.toMillis === "function") {
      startedAtMs = startedAt.toMillis();
    } else if (
      "seconds" in startedAt &&
      typeof startedAt.seconds === "number"
    ) {
      startedAtMs = startedAt.seconds * 1000;
    }
  }

  return (
    !Number.isFinite(startedAtMs) ||
    startedAtMs <= 0 ||
    now - startedAtMs >= PROCESSING_LOCK_TIMEOUT_MS
  );
}

export function isPrivilegedRole(role: unknown): role is "approver" | "admin" {
  return role === "approver" || role === "admin";
}

export function canAccessRole(
  role: unknown,
  allowedRoles: readonly UserRole[],
): role is UserRole {
  if (role !== "basic" && !isPrivilegedRole(role)) {
    return false;
  }

  return allowedRoles.includes(role);
}

export function initialTicketStatus(role: UserRole): TicketStatus {
  return isPrivilegedRole(role) ? "pending_ai_analysis" : "pending_approval";
}

export function canBeginTicketProcessing(status: unknown) {
  return (
    typeof status === "string" &&
    PROCESSABLE_STATUSES.some((allowedStatus) => allowedStatus === status)
  );
}

export function canApproveTicket(status: unknown) {
  return status === "pending_approval";
}

export function canRejectTicket(status: unknown) {
  return status === "pending_approval";
}
