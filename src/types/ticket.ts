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
  startDate: string;
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

export interface TicketClimateContext {
  location: {
    name: string;
    state: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  source: string;
  period: {
    startDate: string;
    endDate: string;
    daysAnalyzed: number;
  };
  summary: {
    precipitationAverageMm: number;
    rainyDays: number;
    averageTemperatureC: number;
    intenseHeatDays: number;
    averageHumidityPercent: number;
    maxWindKmh: number;
    strongGustDays: number;
    adverseWeatherDays: number;
  };
  notes: string;
}

export interface TicketAiAnalysisMeta {
  id: string;
  executedAt: string;
  model: string;
  promptVersion: string;
  dataSources: string[];
  status: "completed" | "failed";
  result: Record<string, unknown> | null;
}

export interface Ticket {
  id: string;
  createdBy: TicketUserRef;
  construction: TicketConstruction;
  status: TicketStatus;
  approval: TicketApproval;
  iaAnalysis: string | null;
  aiAnalysisMeta: TicketAiAnalysisMeta | null;
  climateContext: TicketClimateContext | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface TicketCreateInput {
  city: string;
  state: string;
  propertyType: string;
  constructionType: string;
  type?: string;
  startDate: string;
  estimatedMonths: number;
  builtArea: number;
}

export interface TicketDecisionInput {
  reviewer: TicketUserRef;
  reason?: string;
}
