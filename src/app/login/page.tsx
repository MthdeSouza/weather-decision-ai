"use client";

import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { GoogleLoginButton } from "@/components/GoogleLoginButton";
import { syncLoggedUser } from "@/services/firebase/auth";
import { auth } from "@/services/firebase/config";

export default function LoginPage() {
  const router = useRouter();
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [authError, setAuthError] = useState("");
  const callbackUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "/";
    }

    return (
      new URLSearchParams(window.location.search).get("callbackUrl") ?? "/"
    );
  }, []);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (active) {
          setIsRestoringSession(false);
        }
        return;
      }

      try {
        await syncLoggedUser(user);
        if (active) {
          router.replace(callbackUrl);
          router.refresh();
        }
      } catch {
        if (active) {
          setAuthError(
            "Sua conta está conectada, mas não foi possível validar o acesso. Tente entrar novamente ou contate o administrador.",
          );
          setIsRestoringSession(false);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [callbackUrl, router]);

  return (
    <main className="flex h-full min-h-0 items-center justify-center overflow-y-auto bg-slate-100 px-4 dark:bg-slate-950">
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
          A home é pública. Entre com sua conta Google para acessar seus
          chamados e o AI Chat.
        </p>

        {isRestoringSession ? (
          <p
            role="status"
            className="mb-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
          >
            Verificando sua sessão...
          </p>
        ) : null}
        {authError ? (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
          >
            {authError}
          </p>
        ) : null}
        <GoogleLoginButton
          callbackUrl={callbackUrl}
          onError={setAuthError}
        />

        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          O login usa Firebase Authentication. Ative o provedor Google no
          Firebase Console e configure as variáveis NEXT_PUBLIC_FIREBASE no
          ambiente do app.
        </p>
      </div>
    </main>
  );
}
