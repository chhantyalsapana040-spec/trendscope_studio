import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import { buildSearchRunBundle } from "@/lib/search-run-bundle";
import { REPORT_KIND_ANALYSIS, REPORT_KIND_TOPIC_ARTICLES, reportKindFromJson } from "@/lib/report-kinds";

const postSchema = z.object({
  searchRunId: z.string().uuid(),
  title: z.string().min(2).max(200).optional(),
});

type ReportMetrics = {
  totalArticles?: number;
  positive?: number;
  neutral?: number;
  negative?: number;
};

type BundleArticleRef = {
  id: string;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function metricValue(value: unknown): ReportMetrics | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as ReportMetrics;
}

function bundleArticleRefs(value: unknown): BundleArticleRef[] {
  if (!Array.isArray(value)) return [];
  return value.filter((article): article is BundleArticleRef => {
    return Boolean(article && typeof article === "object" && typeof (article as { id?: unknown }).id === "string");
  });
}

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("saved_reports")
    .select("id, title, topic_id, created_at, ai_summary, report_json")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const reports = data ?? [];
  const topicIds = [...new Set(reports.map((r) => r.topic_id))];
  const { data: topics } =
    topicIds.length > 0
      ? await admin.from("topics").select("id, name").in("id", topicIds)
      : { data: [] as { id: string; name: string }[] };
  const topicName = new Map((topics ?? []).map((t) => [t.id, t.name]));

  const rows = reports.filter((r) => reportKindFromJson(r.report_json) !== REPORT_KIND_TOPIC_ARTICLES);

  return NextResponse.json({
    reports: rows.map((r) => {
      const report = objectValue(r.report_json);
      const metrics = metricValue(report.metrics);
      return {
        id: r.id,
        title: r.title,
        topic: topicName.get(r.topic_id) ?? "",
        topicId: r.topic_id,
        createdAt: r.created_at,
        summary: r.ai_summary ?? "",
        articleCount: metrics?.totalArticles ?? 0,
        sentimentOverview: metrics
          ? {
              positive: metrics.positive ?? 0,
              neutral: metrics.neutral ?? 0,
              negative: metrics.negative ?? 0,
            }
          : null,
      };
    }),
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

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const admin = createServiceRoleClient();
  const runId = parsed.data.searchRunId;

  const { data: run, error: runErr } = await admin
    .from("search_runs")
    .select("id, topic_id, query_text, filters")
    .eq("id", runId)
    .eq("user_id", user.id)
    .eq("status", "completed")
    .maybeSingle();

  if (runErr || !run) return NextResponse.json({ error: "Search run not found" }, { status: 404 });

  const bundle = await buildSearchRunBundle(admin, user.id, runId);
  if (!bundle) return NextResponse.json({ error: "Unable to load analysis bundle" }, { status: 500 });

  const reportJson = { ...(bundle as Record<string, unknown>), kind: REPORT_KIND_ANALYSIS } as unknown as Json;
  const bundleObj = bundle as unknown as Record<string, unknown>;
  const filters = run.filters as Record<string, unknown> | null;
  const aiSummary =
    typeof filters?.ai_summary === "string" ? filters.ai_summary : (bundleObj.aiSummary as string) ?? "";

  const title = parsed.data.title?.trim() || `Report — ${run.query_text}`;

  const { data: saved, error: saveErr } = await admin
    .from("saved_reports")
    .insert({
      user_id: user.id,
      title,
      topic_id: run.topic_id,
      search_run_id: run.id,
      report_json: reportJson,
      ai_summary: aiSummary,
    })
    .select("id")
    .single();

  if (saveErr || !saved) return NextResponse.json({ error: saveErr?.message ?? "Save failed" }, { status: 400 });

  const articles = bundleArticleRefs(bundleObj.articles);
  for (const a of articles) {
    await admin.from("saved_documents").insert({
      user_id: user.id,
      saved_report_id: saved.id,
      document_id: a.id,
    });
  }

  return NextResponse.json({ id: saved.id });
}
