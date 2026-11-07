"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Futuro", href: "/future" },
  { label: "AIChat", href: "/ai-chat" },
];

export function Sidebar() {
  const pathname = usePathname();

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
        {navItems.map((item) => {
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
    </aside>
  );
}
