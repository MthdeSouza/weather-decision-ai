import type { ReactNode } from "react";

import { ServerSessionGate } from "@/components/ServerSessionGate";

export default function TicketAnalysisLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ServerSessionGate allowedRoles={["approver", "admin"]}>
      {children}
    </ServerSessionGate>
  );
}
