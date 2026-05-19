"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/providers/app-providers";
import { cn } from "@/lib/utils";

type Bundle = {
  run: {
    id: string;
    topicId: string;
    queryText: string;
    status: string;
    topic: { name: string; slug: string };
  };
  metrics: {
    totalArticles: number;
    positive: number;
    neutral: number;
    negative: number;
    avgSentiment: number;
    growth: number | null;
  };
  chartTrend: { date: string; mentions: number; sentiment: number | null }[];
  chartArticleTrend?: { date: string; mentions: number; sentiment: number | null }[];
  chartSentiment: { name: string; value: number }[];
  relatedTopics: { id: string; name: string; score: number }[];
  articles: Array<{
    id: string;
    title: string;
    url: string;
    source: string;
    publishedAt: string | null;
    snippet: string | null;
    relevance: number;
    sentimentLabel: string;
    sentimentScore: number;
  }>;
  aiSummary: string | null;
  keywords: string[];
};

type Source = { id: string; name: string; slug: string };

export default function DashboardClient() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();

  const initialRun = params.get("run");

  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("all");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);

  const [runId, setRunId] = useState<string | null>(initialRun);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingAnalyse, setLoadingAnalyse] = useState(false);

  const [articleOpen, setArticleOpen] = useState(false);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [articleDetail, setArticleDetail] = useState<Record<string, unknown> | null>(null);

  const [watchOpen, setWatchOpen] = useState(false);
  const [interval, setInterval] = useState<"hourly" | "daily" | "weekly" | "monthly">("daily");

  const [saveOpen, setSaveOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const [saveDocsOpen, setSaveDocsOpen] = useState(false);
  const [docsTitle, setDocsTitle] = useState("");
  const [savingDocs, setSavingDocs] = useState(false);
  const [sourcePicker, setSourcePicker] = useState("");

  const loadBundle = useCallback(
    async (id: string) => {
      setLoadingList(true);
      try {
        const res = await fetch(`/api/search-runs/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load results");
        setBundle(data as Bundle);
      } catch (e) {
        toast.push(e instanceof Error ? e.message : "Load failed", "error");
        setBundle(null);
      } finally {
        setLoadingList(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/sources");
        const data = await res.json();
        if (!active) return;
        if (res.ok) {
          const list = (data.sources ?? []) as Source[];
          setSources(list);
          setSelectedSources(list.map((s) => s.slug));
        } else {
          toast.push(String(data.error ?? "Unable to load feeds."), "error");
        }
      } catch {
        if (active) toast.push("Unable to load feeds.", "error");
      } finally {
        if (active) setLoadingSources(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [toast]);

  useEffect(() => {
    queueMicrotask(() => {
      if (runId) void loadBundle(runId);
      else setBundle(null);
    });
  }, [runId, loadBundle]);

  const onAnalyse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim().length < 2) {
      toast.push("Enter a topic with at least 2 characters.", "error");
      return;
    }
    if (selectedSources.length === 0) {
      toast.push("Select at least one source.", "error");
      return;
    }
    setLoadingAnalyse(true);
    try {
      const res = await fetch("/api/trends/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          category,
          dateFrom,
          dateTo,
          sourceSlugs: selectedSources,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        let msg = "Analysis failed";
        if (res.status === 422 && data.error && typeof data.error === "object") {
          const fe = (data.error as { fieldErrors?: Record<string, string[]> }).fieldErrors;
          if (fe && typeof fe === "object") {
            const parts = Object.entries(fe).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => `${k}: ${x}`) : []));
            if (parts.length) msg = parts.join("; ");
            else msg = JSON.stringify(data.error);
          } else msg = JSON.stringify(data.error);
        } else if (typeof data.error === "string") msg = data.error;
        throw new Error(msg);
      }
      const id = data.searchRunId as string;
      setRunId(id);
      router.replace(`/dashboard?run=${encodeURIComponent(id)}`);
      toast.push("Analysis complete.", "success");
      await loadBundle(id);
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Analysis failed", "error");
    } finally {
      setLoadingAnalyse(false);
    }
  };

  const openArticle = async (id: string) => {
    setArticleId(id);
    setArticleOpen(true);
    setArticleDetail(null);
    const res = await fetch(`/api/documents/${id}`);
    const data = await res.json();
    if (res.ok) setArticleDetail(data.document as Record<string, unknown>);
  };

  const addWatchlist = async () => {
    if (!bundle?.run.topicId) return;
    const res = await fetch("/api/watchlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId: bundle.run.topicId, tracking_interval: interval }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.push(String(data.error ?? "Unable to save watchlist"), "error");
      return;
    }
    toast.push("Watchlist updated.", "success");
    setWatchOpen(false);
  };

  const saveDocuments = async () => {
    if (!runId) return;
    setSavingDocs(true);
    try {
      const res = await fetch("/api/saved-articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchRunId: runId, title: docsTitle || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      toast.push("Documents saved for this topic.", "success");
      setSaveDocsOpen(false);
      setDocsTitle("");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSavingDocs(false);
    }
  };

  const saveReport = async () => {
    if (!runId) return;
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ searchRunId: runId, title: reportTitle || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.push(String(data.error ?? "Save failed"), "error");
      return;
    }
    toast.push("Report saved.", "success");
    setSaveOpen(false);
    setReportTitle("");
  };

  const exportSummary = async (format: "pdf" | "csv" | "json") => {
    if (!runId) return;
    const res = await fetch(`/api/search-runs/${runId}`);
    const data = await res.json();
    if (!res.ok) {
      toast.push("Unable to export", "error");
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trend-summary-${runId}.${format === "json" ? "json" : "json"}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.push("Downloaded JSON summary for this run.", "info");
  };

  const showResults = Boolean(runId && bundle && !loadingList);

  const chartData = useMemo(() => {
    const byArticle = bundle?.chartArticleTrend;
    if (Array.isArray(byArticle) && byArticle.length > 0) return byArticle;
    return bundle?.chartTrend ?? [];
  }, [bundle]);

  const chartUsesArticleDates = useMemo(
    () => Array.isArray(bundle?.chartArticleTrend) && (bundle?.chartArticleTrend?.length ?? 0) > 0,
    [bundle]
  );

  const addSourceFromPicker = () => {
    const slug = sourcePicker.trim();
    if (!slug) return;
    setSelectedSources((prev) => (prev.includes(slug) ? prev : [...prev, slug]));
    setSourcePicker("");
  };

  const removeSource = (slug: string) => {
    setSelectedSources((prev) => prev.filter((s) => s !== slug));
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200">
          Trend intelligence workspace
        </div>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">Analyse a trend</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Start with a focused query. After processing, metrics, charts, and evidence appear below.
        </p>
      </div>

      <form
        onSubmit={onAnalyse}
        className="rounded-2xl border border-slate-200 bg-white p-6 card-shadow dark:border-slate-800 dark:bg-slate-950"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2 space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            Topic / keyword
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. generative AI regulation"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-indigo-500/30 focus:ring-4 dark:border-slate-800 dark:bg-slate-950"
            />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
            >
              <option value="all">All</option>
              <option value="technology">Technology</option>
              <option value="business">Business</option>
              <option value="science">Science</option>
              <option value="media">Media</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              From
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              To
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
              />
            </label>
          </div>
          <div className="md:col-span-2 space-y-3">
            <div className="text-sm font-medium text-slate-700 dark:text-slate-200">Sources</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Add feeds from the catalog.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 space-y-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                Add source
                <select
                  value={sourcePicker}
                  onChange={(e) => setSourcePicker(e.target.value)}
                  disabled={loadingSources || sources.length === 0}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                >
                  <option value="">{loadingSources ? "Loading feeds..." : "Choose a feed..."}</option>
                  {sources
                    .filter((s) => !selectedSources.includes(s.slug))
                    .map((s) => (
                      <option key={s.id} value={s.slug}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                onClick={addSourceFromPicker}
                disabled={!sourcePicker || loadingSources}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setSelectedSources(sources.map((s) => s.slug))}
                disabled={loadingSources || sources.length === 0}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-100"
              >
                {loadingSources ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner className="text-indigo-700 dark:text-indigo-100" />
                    Loading
                  </span>
                ) : (
                  "Select all"
                )}
              </button>
            </div>
            {loadingSources ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Spinner className="text-indigo-600" />
                Loading feed catalog...
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {selectedSources.length === 0 ? (
                <span className="text-sm text-slate-500">No sources selected.</span>
              ) : null}
              {selectedSources.map((slug) => {
                const s = sources.find((x) => x.slug === slug);
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => removeSource(slug)}
                    title="Remove source"
                    className={cn(
                      "group inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-left text-sm shadow-sm transition",
                      "border-indigo-200 bg-gradient-to-br from-white to-indigo-50/80 hover:border-red-200 hover:from-red-50 hover:to-white dark:border-indigo-500/30 dark:from-slate-900 dark:to-indigo-950/40 dark:hover:border-red-500/40"
                    )}
                  >
                    <span className="font-medium text-slate-900 dark:text-white">{s?.name ?? slug}</span>
                    <span className="rounded-full bg-slate-900/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 group-hover:text-red-600 dark:bg-white/10 dark:text-slate-400">
                      Remove
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={loadingAnalyse}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white btn-gradient shadow-md transition hover:opacity-95 disabled:opacity-60"
          >
            {loadingAnalyse ? <Spinner className="border-white border-r-transparent" /> : null}
            {loadingAnalyse ? "Analysing…" : "Analyse trend"}
          </button>
          {runId ? (
            <button
              type="button"
              onClick={() => {
                setRunId(null);
                setBundle(null);
                setSaveOpen(false);
                setSaveDocsOpen(false);
                router.replace("/dashboard");
              }}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
            >
              Clear results
            </button>
          ) : null}
        </div>
      </form>

      {loadingList ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <Spinner className="text-indigo-600" />
            <div className="h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />
            <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />
            <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900" />
          </div>
        </div>
      ) : null}

      {showResults && bundle ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{bundle.run.queryText}</h2>
              <p className="text-sm text-slate-500">Topic: {bundle.run.topic.name}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setWatchOpen(true)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
              >
                Add to watchlist
              </button>
              <button
                type="button"
                onClick={() => {
                  setReportTitle(`Report — ${bundle.run.queryText}`);
                  setSaveOpen(true);
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
              >
                Save report
              </button>
              <button
                type="button"
                onClick={() => {
                  setDocsTitle(`Articles — ${bundle.run.queryText}`);
                  setSaveDocsOpen(true);
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
              >
                Save documents
              </button>
              <button
                type="button"
                onClick={() => void exportSummary("json")}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium dark:border-slate-800 dark:bg-slate-950"
              >
                Export summary
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: "Articles", value: bundle.metrics.totalArticles },
              { label: "Avg sentiment", value: bundle.metrics.avgSentiment.toFixed(2) },
              {
                label: "Growth signal",
                value: bundle.metrics.growth == null ? "n/a" : `${(bundle.metrics.growth * 100).toFixed(1)}%`,
              },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-2xl border border-slate-200 bg-white p-5 card-shadow dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                  {c.label}
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{c.value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">Mentions over time</div>
              <div className="mb-2 text-xs text-slate-500">
                {chartUsesArticleDates
                  ? "Bucketed by article publish date within your selected range."
                  : "Using topic snapshot dates until article dates are available."}
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="m" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="mentions" stroke="#6366f1" fillOpacity={1} fill="url(#m)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Sentiment mix</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bundle.chartSentiment}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {bundle.aiSummary ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
              <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                AI summary
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">{bundle.aiSummary}</p>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Related topics</div>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {bundle.relatedTopics.length === 0 ? <li>No related topics yet.</li> : null}
                {bundle.relatedTopics.map((t) => (
                  <li key={t.id} className="flex items-center justify-between">
                    <span>{t.name}</span>
                    <span className="text-xs text-slate-400">{t.score.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Keywords</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {bundle.keywords.length === 0 ? <span className="text-sm text-slate-500">—</span> : null}
                {bundle.keywords.map((k) => (
                  <span
                    key={k}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Articles</div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {bundle.articles.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">No articles matched this query.</div>
              ) : null}
              {bundle.articles.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => void openArticle(a.id)}
                  className="flex w-full items-start justify-between gap-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-900/40"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{a.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {a.source} · {a.publishedAt ? new Date(a.publishedAt).toLocaleString() : "Unknown date"}
                    </div>
                    {a.snippet ? <div className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{a.snippet}</div> : null}
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <div className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      {a.sentimentLabel}
                    </div>
                    <div className="mt-2 text-slate-400">rel {a.relevance.toFixed(2)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <Modal
        open={articleOpen}
        title="Article"
        onClose={() => setArticleOpen(false)}
        footer={
          articleDetail?.url ? (
            <a
              href={String(articleDetail.url)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-xl btn-gradient px-4 py-2 text-sm font-semibold text-white"
            >
              Open original source
            </a>
          ) : null
        }
      >
        {!articleDetail ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner className="text-indigo-600" /> Loading…
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="text-lg font-semibold text-slate-900 dark:text-white">{String(articleDetail.title ?? "")}</div>
            <div className="text-slate-500">
              {String(articleDetail.source ?? "")} ·{" "}
              {articleDetail.published_at ? new Date(String(articleDetail.published_at)).toLocaleString() : ""}
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {String(articleDetail.summary ?? articleDetail.content_preview ?? "")}
            </div>
            <div className="text-xs text-slate-500">
              Sentiment: {String(articleDetail.sentimentLabel ?? "")} ({String(articleDetail.sentimentScore ?? "")})
            </div>
            <p className="text-xs text-slate-500">
              In-app previews are not available for most publishers; use the external link for the full article.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={watchOpen}
        title="Watchlist interval"
        onClose={() => setWatchOpen(false)}
        footer={
          <button
            type="button"
            onClick={() => void addWatchlist()}
            className="rounded-xl btn-gradient px-4 py-2 text-sm font-semibold text-white"
          >
            Save
          </button>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Choose how often TrendScope should collect fresh snapshots for this topic.
        </p>
        <select
          value={interval}
          onChange={(e) => setInterval(e.target.value as typeof interval)}
          className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
        >
          <option value="hourly">Hourly</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </Modal>

      <Modal
        open={saveDocsOpen}
        title="Save documents"
        onClose={() => setSaveDocsOpen(false)}
        footer={
          <button
            type="button"
            disabled={savingDocs}
            onClick={() => void saveDocuments()}
            className="inline-flex items-center gap-2 rounded-xl btn-gradient px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {savingDocs ? <Spinner className="border-white border-r-transparent" /> : null}
            Save
          </button>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Store every article from this run under the topic &quot;{bundle?.run.topic.name ?? ""}&quot;. View them anytime
          under Saved documents.
        </p>
        <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Title
          <input
            value={docsTitle}
            onChange={(e) => setDocsTitle(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
          />
        </label>
      </Modal>

      <Modal
        open={saveOpen}
        title="Save report"
        onClose={() => setSaveOpen(false)}
        footer={
          <button type="button" onClick={() => void saveReport()} className="rounded-xl btn-gradient px-4 py-2 text-sm font-semibold text-white">
            Save
          </button>
        }
      >
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          Title
          <input
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
          />
        </label>
      </Modal>
    </div>
  );
}
