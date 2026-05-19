"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.replace("/dashboard");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(1100px_520px_at_15%_0%,rgba(59,130,246,0.4),transparent),radial-gradient(800px_480px_at_85%_10%,rgba(147,51,234,0.38),transparent),linear-gradient(195deg,#020617_0%,#312e81_40%,#0f172a_100%)]"
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col px-4 py-10">
        <Link href="/" className="text-sm text-slate-400 hover:text-white">
          ← Back to home
        </Link>
        <div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/55 p-8 shadow-2xl backdrop-blur-xl">
          <div className="text-xs font-semibold uppercase tracking-wide text-violet-200/90">Create workspace</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">Create your workspace</h1>
          <p className="mt-2 text-sm text-slate-400">Register to start saving searches, reports, and watchlists.</p>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-900/60 p-1 text-sm font-semibold">
            <Link href="/login" className="rounded-xl px-3 py-2 text-center text-slate-400 hover:text-white">
              Login
            </Link>
            <span className="rounded-xl bg-white px-3 py-2 text-center text-slate-900">Register</span>
          </div>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Full name
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/40"
                placeholder="Alex Morgan"
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Email
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/40"
                placeholder="you@university.edu"
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Password
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                minLength={8}
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </label>
            {error ? <div className="text-sm text-red-300">{error}</div> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl btn-gradient py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Creating…" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
