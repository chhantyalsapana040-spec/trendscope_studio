"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/providers/app-providers";

type Item = {
  id: string;
  topic_id: string;
  tracking_interval: string;
  status: string;
  last_collected_at: string | null;
  next_collection_at: string | null;
  latest_mention_count: number | null;
  latest_avg_sentiment: number | null;
  trend_movement: string | null;
  topic_name: string;
};

type Bundle = Record<string, unknown>;

type RunEntry = {
  id: string;
  completedAt: string | null;
  createdAt: string | null;
  queryText: string;
  status: string;
  filters: unknown;
  bundle: Bundle | null;
};

type DetailResponse = {
  watchlist: Item;
  topic: { id: string; name: string; slug: string };
  runs: RunEntry[];
};

function filtersSummary(filters: unknown): string {
  const f = filters as Record<string, unknown> | null;
  if (!f) return "";
  const cat = typeof f.category === "string" ? f.category : "";
  const a = typeof f.date_from === "string" ? f.date_from : "";
  const b = typeof f.date_to === "string" ? f.date_to : "";
  const parts: string[] = [];
  if (cat) parts.push(`Category: ${cat}`);
  if (a && b) parts.push(`Article dates: ${a} → ${b}`);
  return parts.join(" · ");
}

function chartMentionsFromBundle(b: Bundle | null): { date: string; mentions: number }[] {
  if (!b) return [];
  const byArticle = b.chartArticleTrend as { date: string; mentions: number }[] | undefined;
  if (Array.isArray(byArticle) && byArticle.length > 0) return byArticle;
  const snap = b.chartTrend as { date: string; mentions: number }[] | undefined;
  return Array.isArray(snap) ? snap : [];
}

function IconSummary(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={props.className} aria-hidden>
      <path d="M4 19V5M8 19V9M12 19v-6M16 19v-3M20 19V11" strokeLinecap="round" />
    </svg>
  );
}

function IconPause(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={props.className} aria-hidden>
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  );
}

function IconPlay(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={props.className} aria-hidden>
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

function IconTrash(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={props.className} aria-hidden>
      <path d="M3 6h18M8 6V4h8v2m-1 0v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6h8zM10 11v6M14 11v6" strokeLinecap="round" />
    </svg>
  );
}

function StatusIndicator({ status }: { status: string }) {
  const active = status === "active";
  if (active) {
    return (
      <span className="inline-flex items-center gap-1 text-indigo-600" title="Active">
        <Spinner className="size-4 border-indigo-500 border-r-transparent" />
        <span className="sr-only">Active</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center" title="Paused / inactive">
      <span className="size-2.5 rounded-full bg-red-500 shadow-sm ring-2 ring-red-500/30" />
      <span className="sr-only">Inactive</span>
    </span>
  );
}

function iconBtnClass(tone: "indigo" | "slate" | "red") {
  const map = {
    indigo: "text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10",
    slate: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
    red: "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10",
  } as const;
  return `inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent transition ${map[tone]}`;
}

function RunCharts({ bundle }: { bundle: Bundle | null }) {
  if (!bundle) return <p className="text-xs text-slate-500">No chart data.</p>;
  const mentions = chartMentionsFromBundle(bundle);
  const chartSentiment = (bundle.chartSentiment as { name: string; value: number }[]) ?? [];
  const m = (bundle.metrics as Record<string, number> | undefined) ?? {};
  const sentimentFallback = [
    { name: "Positive", value: Number(m.positive ?? 0) },
    { name: "Neutral", value: Number(m.neutral ?? 0) },
    { name: "Negative", value: Number(m.negative ?? 0) },
  ];
  const sentData = chartSentiment.length > 0 ? chartSentiment : sentimentFallback;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-100 p-2 dark:border-slate-800">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Mentions</div>
        <div className="h-44 w-full min-w-0">
          {mentions.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">No series</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mentions}>
                <defs>
                  <linearGradient id="wlM" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} width={28} />
                <Tooltip />
                <Area type="monotone" dataKey="mentions" stroke="#6366f1" fillOpacity={1} fill="url(#wlM)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-slate-100 p-2 dark:border-slate-800">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Sentiment</div>
        <div className="h-44 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sentData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} width={28} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function RunNarrativeBlock({ run }: { run: RunEntry }) {
  const b = run.bundle;
  const ai = b && typeof b.aiSummary === "string" ? b.aiSummary : "";
  const keywords = b && Array.isArray(b.keywords) ? (b.keywords as string[]) : [];
  const articles =
    b && Array.isArray(b.articles) ? (b.articles as { id: string; title: string; snippet?: string | null }[]) : [];
  const meta = filtersSummary(run.filters);
  const when = run.completedAt ? new Date(run.completedAt).toLocaleString() : "—";

  return (
    <section className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/30">
      <div>
        <div className="text-sm font-semibold text-slate-900 dark:text-white">{run.queryText}</div>
        <div className="mt-1 text-xs text-slate-500">
          {when}
          {meta ? ` · ${meta}` : ""}
        </div>
      </div>
      <RunCharts bundle={b} />
      {ai ? (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">AI summary</div>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-700 dark:text-slate-200">{ai}</p>
        </div>
      ) : null}
      {keywords.length > 0 ? (
        <div>
          <div className="text-[10px] font-semibold uppercase text-slate-500">Keywords</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {keywords.slice(0, 24).map((k) => (
              <span key={k} className="rounded-full bg-white px-2 py-0.5 text-[10px] dark:bg-slate-800">
                {k}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {articles.length > 0 ? (
        <div>
          <div className="text-[10px] font-semibold uppercase text-slate-500">Articles ({articles.length})</div>
          <ul className="mt-1 max-h-40 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {articles.slice(0, 25).map((a) => (
              <li key={a.id} className="py-1.5 text-xs">
                <div className="font-medium text-slate-900 dark:text-white">{a.title}</div>
                {a.snippet ? <div className="line-clamp-2 text-slate-500">{a.snippet}</div> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export default function WatchlistPage() {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [searchFilter, setSearchFilter] = useState<"all" | string>("all");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/watchlists");
      const data = await res.json();
      if (res.ok) setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => void load());
  }, []);

  const patch = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/watchlists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json();
      toast.push(String(d.error ?? "Update failed"), "error");
      return;
    }
    toast.push("Updated.", "success");
    await load();
    setDetail((prev) => {
      if (!prev || prev.watchlist.id !== id) return prev;
      return {
        ...prev,
        watchlist: {
          ...prev.watchlist,
          ...(body.tracking_interval ? { tracking_interval: String(body.tracking_interval) } : {}),
          ...(body.status ? { status: String(body.status) } : {}),
        },
      };
    });
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this topic from your watchlist?")) return;
    const res = await fetch(`/api/watchlists/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.push("Remove failed", "error");
      return;
    }
    toast.push("Removed.", "success");
    await load();
  };

  const openDetail = async (id: string) => {
    setDetailOpen(true);
    setDetail(null);
    setSearchFilter("all");
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/watchlists/${id}/detail`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setDetail(data as DetailResponse);
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Failed to load", "error");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const runs = detail?.runs ?? [];
  const filteredRuns = useMemo(() => {
    if (searchFilter === "all") return runs;
    return runs.filter((r) => r.id === searchFilter);
  }, [runs, searchFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white sm:text-3xl">Watchlist</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Open a topic to see every completed search for that topic with charts and filters. Use the dropdown to focus on
          one run or view all. 
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center rounded-2xl border border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-950">
          <Spinner className="text-indigo-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950">
          No watchlist items yet.
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-950">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3">Topic</th>
                  <th className="px-4 py-3">Interval</th>
                  <th className="px-4 py-3">Last / Next</th>
                  <th className="px-4 py-3">Latest</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {items.map((w) => (
                  <tr key={w.id} className="text-slate-700 dark:text-slate-200">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void openDetail(w.id)}
                        className="text-left font-medium text-indigo-700 hover:underline dark:text-indigo-300"
                      >
                        {w.topic_name}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={w.tracking_interval}
                        onChange={(e) => void patch(w.id, { tracking_interval: e.target.value })}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-950"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="hourly">hourly</option>
                        <option value="daily">daily</option>
                        <option value="weekly">weekly</option>
                        <option value="monthly">monthly</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <div>Last: {w.last_collected_at ? new Date(w.last_collected_at).toLocaleString() : "—"}</div>
                      <div>Next: {w.next_collection_at ? new Date(w.next_collection_at).toLocaleString() : "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>Mentions: {w.latest_mention_count ?? "—"}</div>
                      <div>Sentiment: {w.latest_avg_sentiment == null ? "—" : w.latest_avg_sentiment.toFixed(3)}</div>
                      <div>Move: {w.trend_movement ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusIndicator status={w.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1">
                        <button
                          type="button"
                          className={iconBtnClass("indigo")}
                          title="Summaries & charts"
                          aria-label="Summaries and charts"
                          onClick={() => void openDetail(w.id)}
                        >
                          <IconSummary className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          className={iconBtnClass("slate")}
                          title={w.status === "active" ? "Pause" : "Resume"}
                          aria-label={w.status === "active" ? "Pause" : "Resume"}
                          onClick={() => void patch(w.id, { status: w.status === "active" ? "paused" : "active" })}
                        >
                          {w.status === "active" ? <IconPause className="h-4 w-4" /> : <IconPlay className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          className={iconBtnClass("red")}
                          title="Remove"
                          aria-label="Remove from watchlist"
                          onClick={() => void remove(w.id)}
                        >
                          <IconTrash className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 lg:hidden">
            {items.map((w) => (
              <div key={w.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="text-left text-base font-semibold text-indigo-700 dark:text-indigo-300"
                    onClick={() => void openDetail(w.id)}
                  >
                    {w.topic_name}
                  </button>
                  <StatusIndicator status={w.status} />
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Last: {w.last_collected_at ? new Date(w.last_collected_at).toLocaleString() : "—"} · Next:{" "}
                  {w.next_collection_at ? new Date(w.next_collection_at).toLocaleString() : "—"}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span>Mentions {w.latest_mention_count ?? "—"}</span>
                  <span>·</span>
                  <span>Sentiment {w.latest_avg_sentiment == null ? "—" : w.latest_avg_sentiment.toFixed(3)}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    value={w.tracking_interval}
                    onChange={(e) => void patch(w.id, { tracking_interval: e.target.value })}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-950"
                  >
                    <option value="hourly">hourly</option>
                    <option value="daily">daily</option>
                    <option value="weekly">weekly</option>
                    <option value="monthly">monthly</option>
                  </select>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className={iconBtnClass("indigo")}
                      title="Summaries"
                      aria-label="Summaries"
                      onClick={() => void openDetail(w.id)}
                    >
                      <IconSummary className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className={iconBtnClass("slate")}
                      title={w.status === "active" ? "Pause" : "Resume"}
                      aria-label={w.status === "active" ? "Pause" : "Resume"}
                      onClick={() => void patch(w.id, { status: w.status === "active" ? "paused" : "active" })}
                    >
                      {w.status === "active" ? <IconPause className="h-4 w-4" /> : <IconPlay className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      className={iconBtnClass("red")}
                      title="Remove"
                      aria-label="Remove"
                      onClick={() => void remove(w.id)}
                    >
                      <IconTrash className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={detailOpen} title={detail?.topic.name ?? "Topic history"} onClose={() => setDetailOpen(false)} wide>
        {detailLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
            <Spinner className="text-indigo-600" /> Loading search history…
          </div>
        ) : !detail ? (
          <div className="text-sm text-slate-500">Nothing to show.</div>
        ) : (
          <div className="max-h-[78vh] space-y-4 overflow-y-auto pr-1 text-sm text-slate-700 dark:text-slate-200">
            <div className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div>Tracking: {detail.watchlist.tracking_interval}</div>
                <div className="mt-1 flex items-center gap-2">
                  <span>Collection:</span>
                  <StatusIndicator status={detail.watchlist.status} />
                </div>
              </div>
              <label className="flex min-w-[12rem] flex-col gap-1 font-medium text-slate-700 dark:text-slate-200">
                Filter by search
                <select
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value as "all" | string)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="all">All searches ({runs.length})</option>
                  {runs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {(r.completedAt ? new Date(r.completedAt).toLocaleString() : "Run") + " — " + r.queryText}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {runs.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                No completed analyses for this topic yet. Run a search on the dashboard for this topic first.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRuns.map((r) => (
                  <RunNarrativeBlock key={r.id} run={r} />
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
