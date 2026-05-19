import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import { buildSearchRunBundle } from "@/lib/search-run-bundle";
import { REPORT_KIND_TOPIC_ARTICLES, reportKindFromJson } from "@/lib/report-kinds";
import { decodeHtmlEntities } from "@/lib/html";

const postSchema = z.object({
  searchRunId: z.string().uuid(),
  title: z.string().min(2).max(200).optional(),
});

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
  const { data: saves, error } = await admin
    .from("saved_reports")
    .select("id, title, topic_id, created_at, report_json")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const articleSaves = (saves ?? []).filter((r) => reportKindFromJson(r.report_json) === REPORT_KIND_TOPIC_ARTICLES);
  const topicIds = [...new Set(articleSaves.map((r) => r.topic_id))];
  const { data: topics } =
    topicIds.length > 0
      ? await admin.from("topics").select("id, name").in("id", topicIds)
      : { data: [] as { id: string; name: string }[] };
  const topicName = new Map((topics ?? []).map((t) => [t.id, t.name]));

  const byTopic = new Map<
    string,
    {
      topicId: string;
      topicName: string;
      saves: Array<{
        id: string;
        title: string;
        createdAt: string;
        articleCount: number;
        articles: Array<{ id: string; title: string; url: string; publishedAt: string | null }>;
      }>;
    }
  >();

  for (const row of articleSaves) {
    const { data: links } = await admin.from("saved_documents").select("document_id").eq("saved_report_id", row.id);
    const docIds = (links ?? []).map((l) => l.document_id);
    const { data: docs } =
      docIds.length > 0
        ? await admin.from("documents").select("id, url, title, published_at").in("id", docIds)
        : { data: [] as { id: string; url: string; title: string; published_at: string | null }[] };

    const articles = (docs ?? []).map((d) => ({
      id: d.id,
      title: decodeHtmlEntities(d.title),
      url: d.url,
      publishedAt: d.published_at,
    }));

    const entry = byTopic.get(row.topic_id) ?? {
      topicId: row.topic_id,
      topicName: topicName.get(row.topic_id) ?? "Topic",
      saves: [],
    };
    entry.saves.push({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      articleCount: articles.length,
      articles,
    });
    byTopic.set(row.topic_id, entry);
  }

  return NextResponse.json({ topics: [...byTopic.values()] });
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

  const bundleObj = bundle as unknown as Record<string, unknown>;
  const filters = run.filters as Record<string, unknown> | null;
  const aiSummary =
    typeof filters?.ai_summary === "string" ? filters.ai_summary : (bundleObj.aiSummary as string) ?? "";

  const reportJson = {
    kind: REPORT_KIND_TOPIC_ARTICLES,
    topicId: run.topic_id,
    queryText: run.query_text,
    searchRunId: run.id,
    metrics: bundleObj.metrics ?? null,
  } as unknown as Json;

  const title = parsed.data.title?.trim() || `Saved articles — ${run.query_text}`;

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

  const articles = (bundleObj.articles as { id: string }[] | undefined) ?? [];
  for (const a of articles) {
    await admin.from("saved_documents").insert({
      user_id: user.id,
      saved_report_id: saved.id,
      document_id: a.id,
    });
  }

  return NextResponse.json({ id: saved.id });
}
