import type { Timestamp } from "firebase/firestore";

export type TicketStatus =
  | "pending_approval"
  | "pending_ai_analysis"
  | "processing"
  | "completed"
  | "rejected";

export type PropertyType =
  | "residential"
  | "commercial"
  | "industrial"
  | "warehouse"
  | "infrastructure"
  | "other";

export type ConstructionType =
  | "masonry"
  | "steel_frame"
  | "wood_frame"
  | "concrete"
  | "mixed"
  | "other";

export interface TicketUserRef {
  uid: string;
  name: string;
  email: string;
}

export interface TicketConstruction {
  city: string;
  state: string;
  propertyType: string;
  constructionType: string;
  type?: string;
  estimatedMonths: number;
  builtArea: number;
}

export interface TicketApproval {
  approvedBy: TicketUserRef | null;
  approvedAt: Timestamp | null;
  rejectedBy: TicketUserRef | null;
  rejectedAt: Timestamp | null;
  rejectionReason: string | null;
}

export interface Ticket {
  id: string;
  createdBy: TicketUserRef;
  construction: TicketConstruction;
  status: TicketStatus;
  approval: TicketApproval;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface TicketCreateInput {
  city: string;
  state: string;
  propertyType: string;
  constructionType: string;
  type?: string;
  estimatedMonths: number;
  builtArea: number;
}

export interface TicketDecisionInput {
  reviewer: TicketUserRef;
  reason?: string;
}
