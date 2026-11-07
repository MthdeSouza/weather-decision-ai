"use client";

import { useMemo } from "react";

import { GoogleLoginButton } from "@/components/GoogleLoginButton";

export default function LoginPage() {
  const callbackUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "/";
    }

    return (
      new URLSearchParams(window.location.search).get("callbackUrl") ?? "/"
    );
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
            Acesso
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-50">
            Faça login para continuar
          </h1>
        </div>

        <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">
          Apenas a home é pública. Para acessar o chat e a página futura, é
          necessário entrar com sua conta Google.
        </p>

        <GoogleLoginButton callbackUrl={callbackUrl} />

        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Configure as variáveis GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e
          AUTH_SECRET no arquivo .env.local para habilitar o login.
        </p>
      </div>
    </main>
  );
}
