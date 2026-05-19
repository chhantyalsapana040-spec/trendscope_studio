"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { WORKSPACE_NAV } from "@/lib/nav-links";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

function initialsFrom(name: string, email: string | undefined): string {
  const n = name.trim();
  if (n.length >= 2) return (n[0] + n[n.length - 1]).toUpperCase();
  if (n.length === 1) return n[0].toUpperCase();
  const local = email?.split("@")[0] ?? "?";
  return local.slice(0, 2).toUpperCase() || "?";
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState<string | undefined>();

  useEffect(() => {
    queueMicrotask(() => {
      void (async () => {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (res.ok) {
          setEmail(data.email as string | undefined);
          const fn = (data.profile?.full_name as string) ?? "";
          setDisplayName(fn);
        }
      })();
    });
  }, []);

  const initials = useMemo(() => initialsFrom(displayName, email), [displayName, email]);
  const workspaceLabel = displayName.trim() || email?.split("@")[0] || "Workspace";

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }, [router]);

  useEffect(() => {
    queueMicrotask(() => setMobileOpen(false));
  }, [pathname]);

  return (
    <div className="min-h-screen grid-bg dark:text-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 md:px-6">
          <div className="md:hidden">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <span className="sr-only">Menu</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          <div className="flex flex-1 justify-end gap-2 sm:gap-3">
            
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 sm:text-sm"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-[min(100%,20rem)] flex-col border-r border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
                  {initials}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{workspaceLabel}</div>
                  {email ? <div className="truncate text-xs text-slate-500">{email}</div> : null}
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
                onClick={() => setMobileOpen(false)}
              >
                Close
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {WORKSPACE_NAV.map((l) => {
                const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cn(
                      "block rounded-xl px-3 py-2.5 text-sm font-medium",
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
            <div className="border-t border-slate-100 p-3 dark:border-slate-800">
              <button
                type="button"
                onClick={() => void signOut()}
                className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:text-slate-100"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex max-w-7xl">
        <AppSidebar initials={initials} workspaceLabel={workspaceLabel} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
