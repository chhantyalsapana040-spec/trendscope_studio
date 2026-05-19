"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { useToast } from "@/components/providers/app-providers";
import { Spinner } from "@/components/ui/spinner";

type Prev = { topicId: string; latestRunId: string; name: string; createdAt: string };

type SeriesItem = {
  label: string;
  searchRunId: string;
  trend: { date: string; mentions: number }[];
  sentimentAvg: number;
  totalArticles: number;
  positive: number;
  neutral: number;
  negative: number;
  growth: number | null;
  dateFrom: string | null;
  dateTo: string | null;
  aiSummary: string | null;
  topKeywords: string[];
};

export default function ComparePage() {
  const toast = useToast();
  const [previous, setPrevious] = useState<Prev[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [series, setSeries] = useState<SeriesItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/topics/previous");
      const data = await res.json();
      if (res.ok) setPrevious(data.topics ?? []);
    })();
  }, []);

  const warning = selected.length > 4;

  const toggle = (runId: string) => {
    setSelected((prev) => (prev.includes(runId) ? prev.filter((x) => x !== runId) : [...prev, runId]));
  };

  const runCompare = async () => {
    if (selected.length < 2) {
      toast.push("Select at least two previously analysed topics.", "error");
      return;
    }
    if (selected.length > 4) {
      toast.push("You can compare at most four topics at once.", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchRunIds: selected.slice(0, 4) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Compare failed");
      setSeries((data.series ?? []) as SeriesItem[]);
      toast.push("Comparison ready.", "success");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Compare failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const mergedChart = useMemo(() => {
    if (series.length === 0) return [];
    const dates = new Set<string>();
    for (const s of series) for (const p of s.trend) dates.add(p.date);
    const sorted = [...dates].sort();
    return sorted.map((d) => {
      const row: Record<string, string | number> = { date: d };
      for (const s of series) {
        const hit = s.trend.find((t) => t.date === d);
        row[s.label] = hit?.mentions ?? 0;
      }
      return row;
    });
  }, [series]);

  const sentimentCompareData = useMemo(() => {
    return series.map((s) => ({
      label: s.label.slice(0, 18) + (s.label.length > 18 ? "…" : ""),
      positive: s.positive,
      neutral: s.neutral,
      negative: s.negative,
    }));
  }, [series]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white sm:text-3xl">Compare trends</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Select up to four completed runs. Charts use article publish-day buckets when available, otherwise snapshot
          history. The table summarizes volume, sentiment split, date filters from each run, and growth.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 card-shadow sm:p-6 dark:border-slate-800 dark:bg-slate-950">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">Previously searched topics</div>
        {previous.length === 0 ? (
          <div className="mt-4 text-sm text-slate-500">No completed analyses yet. Run a search from the dashboard.</div>
        ) : (
          <div className="mt-4 space-y-2">
            {previous.map((p) => {
              const checked = selected.includes(p.latestRunId);
              return (
                <label
                  key={p.latestRunId}
                  className="flex cursor-pointer flex-col gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"
                >
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={checked} onChange={() => toggle(p.latestRunId)} className="mt-1" />
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{p.name}</div>
                      <div className="text-xs text-slate-500">Last run {new Date(p.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                  <Link className="shrink-0 text-xs font-semibold text-indigo-600 hover:underline sm:self-center" href={`/dashboard?run=${p.latestRunId}`}>
                    Open
                  </Link>
                </label>
              );
            })}
          </div>
        )}

        {warning ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            You selected more than four topics. Deselect extras — the maximum comparison size is four.
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => void runCompare()}
            className="inline-flex items-center gap-2 rounded-xl btn-gradient px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? <Spinner className="border-white border-r-transparent" /> : null}
            {loading ? "Comparing…" : "Compare selected"}
          </button>
        </div>
      </div>

      {series.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3">Topic</th>
                <th className="px-4 py-3">Articles</th>
                <th className="px-4 py-3">Avg sentiment</th>
                <th className="px-4 py-3">+ / ~ / −</th>
                <th className="px-4 py-3">Growth</th>
                <th className="px-4 py-3">Article date filter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {series.map((s) => (
                <tr key={s.searchRunId} className="text-slate-700 dark:text-slate-200">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{s.label}</td>
                  <td className="px-4 py-3">{s.totalArticles}</td>
                  <td className="px-4 py-3">{s.sentimentAvg.toFixed(3)}</td>
                  <td className="px-4 py-3 text-xs">
                    {s.positive} / {s.neutral} / {s.negative}
                  </td>
                  <td className="px-4 py-3 text-xs">{s.growth == null ? "—" : `${(s.growth * 100).toFixed(1)}%`}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {s.dateFrom && s.dateTo ? (
                      <>
                        {s.dateFrom} → {s.dateTo}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {series.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Mentions by day</div>
          <div className="h-64 w-full min-w-0 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mergedChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={36} />
                <Tooltip />
                <Legend />
                {series.map((s, i) => (
                  <Line
                    key={s.searchRunId}
                    type="monotone"
                    dataKey={s.label}
                    stroke={["#6366f1", "#22c55e", "#f97316", "#a855f7"][i % 4]}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {series.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Sentiment volume by topic</div>
          <div className="h-64 w-full min-w-0 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sentimentCompareData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={56} />
                <YAxis tick={{ fontSize: 10 }} width={36} />
                <Tooltip />
                <Legend />
                <Bar dataKey="positive" stackId="a" fill="#22c55e" name="Positive" />
                <Bar dataKey="neutral" stackId="a" fill="#94a3b8" name="Neutral" />
                <Bar dataKey="negative" stackId="a" fill="#ef4444" name="Negative" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {series.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {series.map((s) => (
            <div key={s.searchRunId} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{s.label}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-3">
                <div>
                  <div className="text-[10px] uppercase text-slate-400">Articles</div>
                  <div className="font-semibold text-slate-900 dark:text-white">{s.totalArticles}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-400">Avg sentiment</div>
                  <div className="font-semibold text-slate-900 dark:text-white">{s.sentimentAvg.toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-400">Growth</div>
                  <div className="font-semibold text-slate-900 dark:text-white">{s.growth == null ? "—" : `${(s.growth * 100).toFixed(1)}%`}</div>
                </div>
              </div>
              {s.topKeywords.length > 0 ? (
                <div className="mt-3">
                  <div className="text-[10px] font-semibold uppercase text-slate-400">Top keywords</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.topKeywords.map((k) => (
                      <span key={k} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] dark:bg-slate-800">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {s.aiSummary ? (
                <p className="mt-3 line-clamp-6 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{s.aiSummary}</p>
              ) : (
                <p className="mt-3 text-xs text-slate-500">No AI summary stored on this run.</p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
