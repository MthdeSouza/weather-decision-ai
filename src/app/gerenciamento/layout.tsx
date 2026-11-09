import type { ReactNode } from "react";

import { ServerSessionGate } from "@/components/ServerSessionGate";

export default function TicketManagementLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ServerSessionGate allowedRoles={["admin"]}>{children}</ServerSessionGate>;
}
