"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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

type ReportListItem = {
  id: string;
  title: string;
  topic: string;
  createdAt: string;
  summary: string;
  articleCount: number;
};

function renderBoldSegments(text: string): ReactNode {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function ReportsPage() {
  const toast = useToast();
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [metricsMode, setMetricsMode] = useState<"chart" | "json">("chart");
  const [articleOpen, setArticleOpen] = useState(false);
  const [articleId, setArticleId] = useState<string | null>(null);
  const [articleDetail, setArticleDetail] = useState<Record<string, unknown> | null>(null);

  const load = async () => {
    const res = await fetch("/api/reports");
    const data = await res.json();
    if (res.ok) setReports(data.reports ?? []);
  };

  useEffect(() => {
    queueMicrotask(() => void load());
  }, []);

  const openReport = async (id: string) => {
    setActiveId(id);
    setOpen(true);
    setDetail(null);
    setMetricsMode("chart");
    const res = await fetch(`/api/reports/${id}`);
    const data = await res.json();
    if (!res.ok) {
      toast.push("Unable to load report", "error");
      return;
    }
    setDetail(data as Record<string, unknown>);
  };

  const exportReport = (format: "pdf" | "csv" | "json") => {
    if (!activeId) return;
    window.open(`/api/reports/${activeId}/export?format=${format}`, "_blank");
  };

  const report = useMemo(() => detail?.report as Record<string, unknown> | undefined, [detail]);
  const bundle = useMemo(
    () => (report?.report_json ?? {}) as Record<string, unknown>,
    [report]
  );
  const metrics = useMemo(
    () => (bundle.metrics as Record<string, number> | undefined) ?? {},
    [bundle]
  );
  const chartArticleTrend = (bundle.chartArticleTrend as { date: string; mentions: number }[] | undefined) ?? [];
  const chartTrend = (bundle.chartTrend as { date: string; mentions: number }[] | undefined) ?? [];
  const trendData = chartArticleTrend.length > 0 ? chartArticleTrend : chartTrend;
  const chartSentiment = (bundle.chartSentiment as { name: string; value: number }[] | undefined) ?? [];

  const sentimentRows = useMemo(
    () => [
      { name: "Positive", value: Number(metrics.positive ?? 0) },
      { name: "Neutral", value: Number(metrics.neutral ?? 0) },
      { name: "Negative", value: Number(metrics.negative ?? 0) },
    ],
    [metrics]
  );

  const openArticle = async (id: string) => {
    setArticleId(id);
    setArticleOpen(true);
    setArticleDetail(null);
    const res = await fetch(`/api/documents/${id}`);
    const data = await res.json();
    if (res.ok) setArticleDetail(data.document as Record<string, unknown>);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white sm:text-3xl">Reports</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
          Saved analyses include metrics, charts, and evidence. Open an article the same way as on the dashboard.
        </p>
      </div>

      <div className="grid gap-3">
        {reports.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950">
            No saved reports yet.
          </div>
        ) : null}
        {reports.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => void openReport(r.id)}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left card-shadow transition hover:-translate-y-0.5 dark:border-slate-800 dark:bg-slate-950"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">{r.title}</div>
                <div className="mt-1 text-xs text-slate-500">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{r.topic}</span>
                  {" · "}
                  {new Date(r.createdAt).toLocaleString()} · {r.articleCount} articles
                </div>
                {r.summary ? (
                  <div className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{renderBoldSegments(r.summary)}</div>
                ) : null}
              </div>
              <span className="shrink-0 text-xs font-semibold text-indigo-600">View</span>
            </div>
          </button>
        ))}
      </div>

      <Modal
        open={open}
        title={String(report?.title ?? "Report")}
        onClose={() => setOpen(false)}
        wide
        footer={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl btn-gradient px-4 py-2 text-sm font-semibold text-white"
              onClick={() => exportReport("pdf")}
            >
              Export PDF
            </button>
            <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-800" onClick={() => exportReport("csv")}>
              Export CSV
            </button>
            <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-800" onClick={() => exportReport("json")}>
              Export JSON
            </button>
          </div>
        }
      >
        {!detail ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner className="text-indigo-600" /> Loading…
          </div>
        ) : (
          <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI summary</div>
              <div className="mt-2 whitespace-pre-wrap leading-relaxed">{renderBoldSegments(String(report?.ai_summary ?? ""))}</div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMetricsMode("chart")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  metricsMode === "chart" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "border border-slate-200 dark:border-slate-700"
                }`}
              >
                Charts
              </button>
              <button
                type="button"
                onClick={() => setMetricsMode("json")}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  metricsMode === "json" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "border border-slate-200 dark:border-slate-700"
                }`}
              >
                JSON
              </button>
            </div>

            {metricsMode === "json" ? (
              <>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Metrics</div>
                <pre className="overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-900">{JSON.stringify(metrics, null, 2)}</pre>
              </>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-100 p-2 dark:border-slate-800">
                  <div className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">Mentions trend</div>
                  <div className="h-52 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="repM" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} width={32} />
                        <Tooltip />
                        <Area type="monotone" dataKey="mentions" stroke="#6366f1" fillOpacity={1} fill="url(#repM)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-100 p-2 dark:border-slate-800">
                  <div className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">Sentiment mix</div>
                  <div className="h-52 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartSentiment.length ? chartSentiment : sentimentRows}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} width={32} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Articles ({Array.isArray(bundle.articles) ? bundle.articles.length : 0})
              </div>
              <div className="mt-2 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                {(Array.isArray(bundle.articles) ? bundle.articles : []).map((a: { id?: string; title?: string }) => (
                  <button
                    key={String(a.id)}
                    type="button"
                    onClick={() => a.id && void openArticle(String(a.id))}
                    className="flex w-full items-start px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-900/50"
                  >
                    <span className="font-medium text-indigo-700 dark:text-indigo-300">{String(a.title ?? "")}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

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
              {articleDetail.published_at ? new Date(String(articleDetail.published_at)).toLocaleString() : ""}
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {String(articleDetail.summary ?? articleDetail.content_preview ?? "")}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
