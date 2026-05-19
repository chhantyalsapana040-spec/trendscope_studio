"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/dashboard";
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.replace(redirect);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_600px_at_20%_-10%,rgba(99,102,241,0.45),transparent),radial-gradient(900px_500px_at_90%_20%,rgba(168,85,247,0.35),transparent),linear-gradient(165deg,#020617_0%,#1e1b4b_45%,#0f172a_100%)]"
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col px-4 py-10">
        <Link href="/" className="text-sm text-slate-400 hover:text-white">
          ← Back to home
        </Link>
        <div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/55 p-8 shadow-2xl backdrop-blur-xl">
          <div className="text-xs font-semibold uppercase tracking-wide text-indigo-200/90">Secure sign in</div>
          <h1 className="mt-2 text-3xl font-semibold text-white">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-400">Sign in with your Supabase-backed account.</p>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-900/60 p-1 text-sm font-semibold">
            <span className="rounded-xl bg-white px-3 py-2 text-center text-slate-900">Login</span>
            <Link href="/register" className="rounded-xl px-3 py-2 text-center text-slate-400 hover:text-white">
              Register
            </Link>
          </div>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
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
                className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </label>
            {error ? <div className="text-sm text-red-300">{error}</div> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl btn-gradient py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
