import type { TicketStatus } from "@/types/ticket";

export const PROPERTY_TYPES = [
  { value: "residential", label: "Residencial" },
  { value: "commercial", label: "Comercial" },
  { value: "industrial", label: "Industrial" },
  { value: "warehouse", label: "Galpão" },
  { value: "infrastructure", label: "Infraestrutura" },
  { value: "other", label: "Outros" },
] as const;

export const CONSTRUCTION_TYPES = [
  { value: "masonry", label: "Alvenaria" },
  { value: "steel_frame", label: "Steel Frame" },
  { value: "wood_frame", label: "Wood Frame" },
  { value: "concrete", label: "Concreto" },
  { value: "mixed", label: "Misto" },
  { value: "other", label: "Outros" },
] as const;

export const BRAZILIAN_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  pending_approval: "Aguardando aprovação",
  pending_ai_analysis: "Aguardando IA",
  processing: "Em processamento",
  completed: "Concluído",
  failed: "Falhou na análise",
  rejected: "Reprovado",
};

export const TICKET_STATUS_STYLES: Record<TicketStatus, string> = {
  pending_approval: "bg-amber-100 text-amber-700 border border-amber-200",
  pending_ai_analysis: "bg-sky-100 text-sky-700 border border-sky-200",
  processing: "bg-violet-100 text-violet-700 border border-violet-200",
  completed: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  failed: "bg-red-100 text-red-700 border border-red-200",
  rejected: "bg-rose-100 text-rose-700 border border-rose-200",
};
