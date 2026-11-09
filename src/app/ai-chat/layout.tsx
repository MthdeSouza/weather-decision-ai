import type { ReactNode } from "react";

import { ServerSessionGate } from "@/components/ServerSessionGate";

export default function AiChatLayout({ children }: { children: ReactNode }) {
  return <ServerSessionGate>{children}</ServerSessionGate>;
}
