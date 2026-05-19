"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WORKSPACE_NAV } from "@/lib/nav-links";
import { cn } from "@/lib/utils";

type Props = {
  initials: string;
  workspaceLabel: string;
};

export function AppSidebar({ initials, workspaceLabel }: Props) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/60 md:flex">
      <div className="px-6 py-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
            {initials}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{workspaceLabel}</div>
            <div className="text-xs text-slate-500">Trend workspace</div>
          </div>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {WORKSPACE_NAV.map((l) => {
          const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "block rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
              )}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 text-xs text-slate-500">Signals from your saved searches and feeds</div>
    </aside>
  );
}
