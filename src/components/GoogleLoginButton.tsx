"use client";

import { signIn } from "next-auth/react";

type GoogleLoginButtonProps = {
  callbackUrl?: string;
};

export function GoogleLoginButton({
  callbackUrl = "/",
}: GoogleLoginButtonProps) {
  const safeCallbackUrl =
    callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/";

  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl: safeCallbackUrl })}
      className="flex w-full items-center justify-center gap-3 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
    >
      <span aria-hidden="true">G</span>
      Entrar com Google
    </button>
  );
}
