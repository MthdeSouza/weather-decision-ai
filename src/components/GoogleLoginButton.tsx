"use client";

import { useRouter } from "next/navigation";

import { loginWithGoogle } from "@/services/firebase/auth";

type GoogleLoginButtonProps = {
  callbackUrl?: string;
  onError?: (message: string) => void;
};

export function GoogleLoginButton({
  callbackUrl = "/",
  onError,
}: GoogleLoginButtonProps) {
  const router = useRouter();
  const safeCallbackUrl =
    callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/";

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
      router.push(safeCallbackUrl);
    } catch (error) {
      console.error("Erro ao entrar com Google:", error);
      onError?.(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar a sessão.",
      );
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogin}
      className="cursor-pointer flex w-full items-center justify-center gap-3 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
    >
      <span aria-hidden="true">G</span>
      Entrar com Google
    </button>
  );
}
