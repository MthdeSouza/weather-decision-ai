import { CONSTRUCTION_TYPES, PROPERTY_TYPES } from "@/constants/tickets";

export const formatDate = (value: unknown) => {
  if (!value) {
    return "-";
  }

  if (typeof value === "string") {
    return new Date(value).toLocaleDateString("pt-BR");
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    const dateValue = value as { toDate: () => Date };
    return dateValue.toDate().toLocaleDateString("pt-BR");
  }

  return new Date(String(value)).toLocaleDateString("pt-BR");
};

export const getPropertyLabel = (value?: string) =>
  PROPERTY_TYPES.find((item) => item.value === value)?.label ?? value ?? "-";

export const getConstructionLabel = (value?: string) =>
  CONSTRUCTION_TYPES.find((item) => item.value === value)?.label ??
  value ??
  "-";
