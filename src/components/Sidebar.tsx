"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { loginWithGoogle, logout } from "@/services/firebase/auth";
import { auth } from "@/services/firebase/config";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Futuro", href: "/future", protected: true },
  { label: "AIChat", href: "/ai-chat", protected: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
    });

    return () => unsubscribe();
  }, []);

  const isAuthenticated = Boolean(user);

  const visibleNavItems = navItems.filter(
    (item) => !item.protected || isAuthenticated,
  );

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
      router.push("/");
    } catch (error) {
      console.error("Erro ao fazer login:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  return (
    <aside className="w-64 border-r border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
          Weather
        </p>
        <h1 className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-50">
          Decision AI
        </h1>
      </div>

      <nav className="space-y-2">
        {visibleNavItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center rounded-xl px-3 py-2 text-sm font-medium transition",
                isActive
                  ? "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
        {isAuthenticated ? (
          <div className="space-y-3">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {user?.displayName ?? "Usuário autenticado"}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="cursor-pointer w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Sair
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleLogin}
            className="cursor-pointer w-full rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
          >
            Entrar com Google
          </button>
        )}
      </div>
    </aside>
  );
}
