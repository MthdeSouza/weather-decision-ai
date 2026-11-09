import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "@/services/firebase/config";
import { getUserProfileByUid } from "@/services/firebase/users";
import { initialTicketStatus } from "@/lib/ticket-workflow";
import type {
  Ticket,
  TicketCreateInput,
  TicketStatus,
} from "@/types/ticket";
import type { UserRole } from "@/types/user";

const ticketsCollection = collection(db, "tickets");

const getTimestampMillis = (value: unknown) => {
  if (!value) {
    return 0;
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }

  if (typeof value === "object" && value !== null && "seconds" in value) {
    return new Date((value as { seconds: number }).seconds * 1000).getTime();
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

export async function getCurrentAuthUser() {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return null;
  }

  const profile = (await getUserProfileByUid(currentUser.uid)) ?? {
    uid: currentUser.uid,
    name: currentUser.displayName ?? "Usuário",
    email: currentUser.email ?? "",
    role: "basic" as UserRole,
  };

  return {
    uid: currentUser.uid,
    name: profile.name ?? currentUser.displayName ?? "Usuário",
    email: profile.email ?? currentUser.email ?? "",
    role: (profile.role ?? "basic") as UserRole,
  };
}

export async function createTicket(input: TicketCreateInput) {
  const user = await getCurrentAuthUser();

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const ticketRef = doc(ticketsCollection);
  const status: TicketStatus = initialTicketStatus(user.role);

  const payload: Ticket = {
    id: ticketRef.id,
    createdBy: {
      uid: user.uid,
      name: user.name,
      email: user.email,
    },
    construction: {
      city: input.city.trim(),
      state: input.state.trim(),
      propertyType: input.propertyType,
      constructionType: input.constructionType,
      type: input.propertyType,
      startDate: input.startDate,
      estimatedMonths: Number(input.estimatedMonths),
      builtArea: Number(input.builtArea),
    },
    status,
    approval: {
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
    },
    iaAnalysis: null,
    aiAnalysisMeta: null,
    climateContext: null,
    createdAt: serverTimestamp() as never,
    updatedAt: serverTimestamp() as never,
  };

  await setDoc(ticketRef, payload);

  return payload;
}

export async function getMyTickets() {
  const user = auth.currentUser;

  if (!user) {
    return [] as Ticket[];
  }

  const q = query(ticketsCollection, where("createdBy.uid", "==", user.uid));

  const snapshot = await getDocs(q);

  return snapshot.docs
    .filter((doc) => (doc.data() as Ticket)?.status !== "archived")
    .map((ticketDoc) => {
      const { id: _ignoredId, ...ticketData } = ticketDoc.data() as Ticket;

      return {
        ...ticketData,
        id: ticketDoc.id,
      } as Ticket;
    })
    .sort(
      (a, b) =>
        getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt),
    );
}

export async function getPendingApprovalTickets() {
  const q = query(ticketsCollection, where("status", "==", "pending_approval"));

  const snapshot = await getDocs(q);

  return snapshot.docs
    .filter((doc) => (doc.data() as Ticket)?.status !== "archived")
    .map((ticketDoc) => {
      const { id: _ignoredId, ...ticketData } = ticketDoc.data() as Ticket;

      return {
        ...ticketData,
        id: ticketDoc.id,
      } as Ticket;
    })
    .sort(
      (a, b) =>
        getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt),
    );
}

export type TicketDashboardStats = {
  total: number;
  pendingApproval: number;
  pendingAiAnalysis: number;
  processing: number;
  completed: number;
  rejected: number;
  failed: number;
};

export const emptyTicketDashboardStats: TicketDashboardStats = {
  total: 0,
  pendingApproval: 0,
  pendingAiAnalysis: 0,
  processing: 0,
  completed: 0,
  rejected: 0,
  failed: 0,
};

export function calculateTicketDashboardStats(
  tickets: Ticket[],
): TicketDashboardStats {
  const stats = { ...emptyTicketDashboardStats };

  for (const ticket of tickets) {
    if (ticket.status === "archived") {
      continue;
    }

    stats.total += 1;

    if (ticket.status === "pending_approval") {
      stats.pendingApproval += 1;
    }

    if (ticket.status === "pending_ai_analysis") {
      stats.pendingAiAnalysis += 1;
    }

    if (ticket.status === "processing") {
      stats.processing += 1;
    }

    if (ticket.status === "completed") {
      stats.completed += 1;
    }

    if (ticket.status === "rejected") {
      stats.rejected += 1;
    }

    if (ticket.status === "failed") {
      stats.failed += 1;
    }
  }

  return stats;
}

export async function getDashboardTickets(): Promise<Ticket[]> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return [];
  }

  const profile = await getCurrentAuthUser();

  if (!profile) {
    return [];
  }

  const isPrivileged = profile.role === "approver" || profile.role === "admin";
  const q = isPrivileged
    ? ticketsCollection
    : query(ticketsCollection, where("createdBy.uid", "==", profile.uid));

  const snapshot = await getDocs(q as never);

  return snapshot.docs
    .filter((doc) => (doc.data() as Ticket)?.status !== "archived")
    .map((ticketDoc) => {
      const { id: _ignoredId, ...ticketData } = ticketDoc.data() as Ticket;

      return {
        ...ticketData,
        id: ticketDoc.id,
      } as Ticket;
    })
    .sort(
      (a, b) =>
        getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt),
    );
}

export async function getAllTicketsForReview(): Promise<Ticket[]> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return [];
  }

  const profile = await getCurrentAuthUser();

  if (!profile || (profile.role !== "approver" && profile.role !== "admin")) {
    return [];
  }

  const snapshot = await getDocs(ticketsCollection);

  return snapshot.docs
    .filter((doc) => (doc.data() as Ticket)?.status !== "archived")
    .map((ticketDoc) => {
      const { id: _ignoredId, ...ticketData } = ticketDoc.data() as Ticket;

      return {
        ...ticketData,
        id: ticketDoc.id,
      } as Ticket;
    })
    .sort(
      (a, b) =>
        getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt),
    );
}

export async function getTicketById(ticketId: string) {
  const ticketRef = doc(db, "tickets", ticketId);
  const snapshot = await getDoc(ticketRef);

  if (!snapshot.exists()) {
    return null;
  }

  const { id: _ignoredId, ...ticketData } = snapshot.data() as Ticket;

  return {
    ...ticketData,
    id: snapshot.id,
  } as Ticket;
}

export { filterAndSortTickets } from "./ticket-filters";
export type { TicketFilterOptions, TicketSortOption } from "./ticket-filters";
