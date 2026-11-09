import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "@/services/firebase/config";
import { getUserProfileByUid } from "@/services/firebase/users";
import type {
  Ticket,
  TicketCreateInput,
  TicketDecisionInput,
  TicketStatus,
} from "@/types/ticket";
import type { UserRole } from "@/types/user";

const ticketsCollection = collection(db, "tickets");

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
  const status: TicketStatus =
    user.role === "basic" ? "pending_approval" : "pending_ai_analysis";

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
    createdAt: serverTimestamp() as never,
    updatedAt: serverTimestamp() as never,
  };

  await setDoc(ticketRef, payload);

  return payload;
}

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

export async function getMyTickets() {
  const user = auth.currentUser;

  if (!user) {
    return [] as Ticket[];
  }

  const q = query(ticketsCollection, where("createdBy.uid", "==", user.uid));

  const snapshot = await getDocs(q);

  return snapshot.docs
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

export async function approveTicket(
  ticketId: string,
  reviewer: TicketDecisionInput["reviewer"],
) {
  const ticketRef = doc(db, "tickets", ticketId);

  await updateDoc(ticketRef, {
    status: "pending_ai_analysis",
    approval: {
      approvedBy: reviewer,
      approvedAt: serverTimestamp(),
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
    },
    updatedAt: serverTimestamp(),
  });
}

export async function rejectTicket(
  ticketId: string,
  reviewer: TicketDecisionInput["reviewer"],
  reason: string,
) {
  const ticketRef = doc(db, "tickets", ticketId);

  await updateDoc(ticketRef, {
    status: "rejected",
    approval: {
      approvedBy: null,
      approvedAt: null,
      rejectedBy: reviewer,
      rejectedAt: serverTimestamp(),
      rejectionReason: reason.trim(),
    },
    updatedAt: serverTimestamp(),
  });
}
