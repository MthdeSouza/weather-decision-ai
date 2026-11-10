import "server-only";

export async function sendPendingApprovalNotification({
  ticketId,
  requesterName,
  requesterEmail,
  city,
  state,
}: {
  ticketId: string;
  requesterName: string;
  requesterEmail: string;
  city: string;
  state: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.RESEND_TO_EMAIL;

  if (!apiKey || !from) {
    throw new Error("Resend email configuration is incomplete.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `ticket-approval-${ticketId}`,
    },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Novo chamado aguardando aprovação (#${ticketId.slice(0, 8)})`,
      text: [
        "Um novo chamado está aguardando aprovação.",
        "",
        `Chamado: #${ticketId}`,
        `Solicitante: ${requesterName} (${requesterEmail})`,
        `Local da obra: ${city} / ${state}`,
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend request failed with status ${response.status}.`);
  }
}
