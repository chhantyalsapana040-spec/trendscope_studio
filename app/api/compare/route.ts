import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { buildSearchRunBundle } from "@/lib/search-run-bundle";

const bodySchema = z.object({
  searchRunIds: z.array(z.string().uuid()).min(2).max(4),
});

type CompareMetrics = {
  positive?: number;
  neutral?: number;
  negative?: number;
  totalArticles?: number;
  avgSentiment?: number;
  growth?: number | null;
};

type TrendPoint = {
  date: string;
  mentions: number;
};

type CompareSeries = {
  searchRunId: string;
  topicId: string;
  label: string;
  totalArticles: number;
  sentimentAvg: number;
  positive: number;
  neutral: number;
  negative: number;
  trend: TrendPoint[];
  growth: number | null;
  dateFrom: string | null;
  dateTo: string | null;
  aiSummary: string | null;
  topKeywords: string[];
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function trendPoints(value: unknown): TrendPoint[] {
  if (!Array.isArray(value)) return [];
  return value.filter((point): point is TrendPoint => {
    if (!point || typeof point !== "object") return false;
    const candidate = point as { date?: unknown; mentions?: unknown };
    return typeof candidate.date === "string" && typeof candidate.mentions === "number";
  });
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const admin = createServiceRoleClient();
  const ids = parsed.data.searchRunIds;

  const { data: runs, error } = await admin
    .from("search_runs")
    .select("id, topic_id, query_text, filters, created_at")
    .in("id", ids)
    .eq("user_id", user.id)
    .eq("status", "completed");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!runs || runs.length !== ids.length) {
    return NextResponse.json({ error: "One or more runs were not found." }, { status: 404 });
  }

  const out: CompareSeries[] = [];
  for (const run of runs) {
    const bundle = objectValue(await buildSearchRunBundle(admin, user.id, run.id));
    const metrics = objectValue(bundle.metrics) as CompareMetrics;
    const pos = metrics.positive ?? 0;
    const neu = metrics.neutral ?? 0;
    const neg = metrics.negative ?? 0;
    const total = metrics.totalArticles ?? 0;
    const avg = typeof metrics.avgSentiment === "number" ? metrics.avgSentiment : 0;

    const articleTrend = trendPoints(bundle.chartArticleTrend);
    const snapTrend = trendPoints(bundle.chartTrend);
    const trend = articleTrend.length > 0 ? articleTrend : snapTrend;

    const filters = run.filters as Record<string, unknown> | null;
    const dateFrom = typeof filters?.date_from === "string" ? filters.date_from : null;
    const dateTo = typeof filters?.date_to === "string" ? filters.date_to : null;

    out.push({
      searchRunId: run.id,
      topicId: run.topic_id,
      label: run.query_text,
      totalArticles: total,
      sentimentAvg: Number(avg.toFixed(4)),
      positive: pos,
      neutral: neu,
      negative: neg,
      trend,
      growth: metrics.growth ?? null,
      dateFrom,
      dateTo,
      aiSummary: typeof bundle.aiSummary === "string" ? bundle.aiSummary : null,
      topKeywords: Array.isArray(bundle.keywords)
        ? bundle.keywords.filter((keyword): keyword is string => typeof keyword === "string").slice(0, 12)
        : [],
    });
  }

  return NextResponse.json({ series: out });
}
