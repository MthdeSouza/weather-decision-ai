import type { Message as ChatMessage } from "@/types/chat";

export function Message({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-xl rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
          isUser
            ? "bg-sky-600 text-white"
            : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
