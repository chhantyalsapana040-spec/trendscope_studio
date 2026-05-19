"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/providers/app-providers";
import { useThemePreference } from "@/components/providers/theme-provider";

export default function SettingsClient() {
  const toast = useToast();
  const { theme, setTheme } = useThemePreference();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [category, setCategory] = useState("all");
  const [dateRange, setDateRange] = useState("30d");
  const [watchInterval, setWatchInterval] = useState<"hourly" | "daily" | "weekly" | "monthly">("daily");
  const [alerts, setAlerts] = useState(true);
  const [exportFmt, setExportFmt] = useState<"pdf" | "csv" | "json">("pdf");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = async () => {
    const res = await fetch("/api/settings");
    const data = await res.json();
    if (!res.ok) return;
    setEmail(String(data.email ?? ""));
    setFullName(String(data.profile?.full_name ?? ""));
    const s = data.settings;
    if (s) {
      setCategory(String(s.dashboard_default_category ?? "all"));
      setDateRange(String(s.dashboard_default_date_range ?? "30d"));
      setWatchInterval(s.watchlist_default_interval ?? "daily");
      setAlerts(Boolean(s.notifications_trend_alerts));
      setExportFmt(s.export_default_format ?? "pdf");
      setTheme(s.theme ?? "system");
    }
  };

  useEffect(() => {
    queueMicrotask(() => void load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSettings = async () => {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName,
        dashboard_default_category: category,
        dashboard_default_date_range: dateRange,
        watchlist_default_interval: watchInterval,
        notifications_trend_alerts: alerts,
        export_default_format: exportFmt,
        theme,
        data_source_preferences: {},
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      toast.push(String(d.error ?? "Save failed"), "error");
      return;
    }
    toast.push("Settings saved.", "success");
  };

  const changePassword = async () => {
    if (password.length < 8) {
      toast.push("Password must be at least 8 characters.", "error");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.push(error.message, "error");
      return;
    }
    setPassword("");
    toast.push("Password updated.", "success");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const deleteAccount = async () => {
    const res = await fetch("/api/account", { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      toast.push(String(d.error ?? "Deletion failed"), "error");
      return;
    }
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Settings</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Manage profile, preferences, and account security.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Profile</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Full name</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950" />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Email</span>
            <input value={email} disabled className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500 dark:border-slate-800 dark:bg-slate-900" />
          </label>
          <div className="md:col-span-2 text-xs text-slate-500">Avatar uploads can be wired to Supabase Storage in a follow-up.</div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Account</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="text-slate-600 dark:text-slate-300">New password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void changePassword()} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-800">
              Update password
            </button>
            <button type="button" onClick={() => void logout()} className="rounded-xl btn-gradient px-4 py-2 text-sm font-semibold text-white">
              Log out
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Preferences</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Default category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
              <option value="all">all</option>
              <option value="technology">technology</option>
              <option value="business">business</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Default date range</span>
            <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
              <option value="7d">7d</option>
              <option value="30d">30d</option>
              <option value="90d">90d</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Default watchlist interval</span>
            <select value={watchInterval} onChange={(e) => setWatchInterval(e.target.value as typeof watchInterval)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
              <option value="hourly">hourly</option>
              <option value="daily">daily</option>
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={alerts} onChange={(e) => setAlerts(e.target.checked)} />
            Trend alerts
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Default export format</span>
            <select value={exportFmt} onChange={(e) => setExportFmt(e.target.value as typeof exportFmt)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
              <option value="pdf">pdf</option>
              <option value="csv">csv</option>
              <option value="json">json</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-slate-600 dark:text-slate-300">Theme</span>
            <select value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
              <option value="light">light</option>
              <option value="dark">dark</option>
              <option value="system">system</option>
            </select>
          </label>
        </div>
        <button type="button" onClick={() => void saveSettings()} className="mt-4 rounded-xl btn-gradient px-4 py-2 text-sm font-semibold text-white">
          Save preferences
        </button>
      </section>

      <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
        <h2 className="font-semibold">Danger zone</h2>
        <p className="mt-2">Deleting your account removes your auth user via the service role. This cannot be undone.</p>
        <button type="button" className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => setDeleteOpen(true)}>
          Delete account
        </button>
      </section>

      <Modal
        open={deleteOpen}
        title="Confirm account deletion"
        onClose={() => setDeleteOpen(false)}
        footer={
          <button type="button" className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => void deleteAccount()}>
            Permanently delete
          </button>
        }
      >
        <p className="text-sm">This will delete your user and sign you out.</p>
      </Modal>
    </div>
  );
}
