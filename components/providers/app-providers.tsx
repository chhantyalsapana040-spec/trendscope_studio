"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ThemeProvider } from "@/components/providers/theme-provider";

type Toast = { id: string; message: string; tone: "success" | "error" | "info" };

const ToastCtx = createContext<{
  push: (message: string, tone?: Toast["tone"]) => void;
} | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within AppProviders");
  return ctx;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = crypto.randomUUID();
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ThemeProvider>
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              "pointer-events-auto max-w-sm rounded-xl px-4 py-3 text-sm shadow-lg border",
              t.tone === "success" && "bg-emerald-50 text-emerald-900 border-emerald-200",
              t.tone === "error" && "bg-red-50 text-red-900 border-red-200",
              t.tone === "info" && "bg-white text-slate-900 border-slate-200 dark:bg-slate-900 dark:text-slate-50 dark:border-slate-700",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
    </ThemeProvider>
  );
}
