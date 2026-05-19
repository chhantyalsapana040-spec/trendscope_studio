import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";
import { decodeHtmlEntities } from "@/lib/html";

export async function buildSearchRunBundle(
  admin: SupabaseClient<Database>,
  userId: string,
  runId: string
): Promise<Json | null> {
  const { data: run, error } = await admin
    .from("search_runs")
    .select("id, status, query_text, filters, error_message, created_at, completed_at, topic_id")
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !run) return null;

  const topicId = run.topic_id as string;
  const filters = run.filters as Record<string, unknown> | null;

  const storedIds = filters?.document_ids;
  let docIds: string[] = Array.isArray(storedIds)
    ? storedIds.filter((x): x is string => typeof x === "string")
    : [];

  if (docIds.length === 0) {
    const { data: docLinks } = await admin
      .from("document_topics")
      .select("document_id, relevance_score")
      .eq("topic_id", topicId)
      .order("relevance_score", { ascending: false })
      .limit(200);
    docIds = (docLinks ?? []).map((r) => r.document_id);
  }

  const relMap = new Map<string, number>();
  if (docIds.length > 0) {
    const { data: docLinks } = await admin
      .from("document_topics")
      .select("document_id, relevance_score")
      .in("document_id", docIds)
      .eq("topic_id", topicId);
    for (const row of docLinks ?? []) relMap.set(row.document_id, row.relevance_score);
  }

  const { data: topicRow } = await admin.from("topics").select("name, slug").eq("id", topicId).single();

  const { data: docs } =
    docIds.length > 0
      ? await admin
          .from("documents")
          .select("id, url, title, summary, published_at, source_platform_id")
          .in("id", docIds)
      : { data: [] as { id: string; url: string; title: string; summary: string | null; published_at: string | null; source_platform_id: string | null }[] };

  const platIds = [...new Set((docs ?? []).map((d) => d.source_platform_id).filter(Boolean))] as string[];
  const { data: platforms } =
    platIds.length > 0
      ? await admin.from("source_platforms").select("id, name, slug").in("id", platIds)
      : { data: [] as { id: string; name: string; slug: string }[] };
  const platName = new Map((platforms ?? []).map((p) => [p.id, p.name]));

  const { data: sents } =
    docIds.length > 0
      ? await admin.from("document_sentiments").select("document_id, label, score").in("document_id", docIds)
      : { data: [] as { document_id: string; label: string; score: number }[] };

  const sentMap = new Map((sents ?? []).map((s) => [s.document_id, s]));

  const { data: relatedRows } = await admin
    .from("related_topics")
    .select("related_topic_id, similarity_score")
    .eq("search_run_id", runId);

  const relatedIds = [...new Set((relatedRows ?? []).map((r) => r.related_topic_id))];
  const { data: relatedTopics } =
    relatedIds.length > 0
      ? await admin.from("topics").select("id, name, slug").in("id", relatedIds)
      : { data: [] as { id: string; name: string; slug: string }[] };
  const relatedName = new Map((relatedTopics ?? []).map((t) => [t.id, t.name]));

  const { data: clusters } = await admin.from("topic_clusters").select("id, label, cluster_index").eq("search_run_id", runId);

  const { data: snapshots } = await admin
    .from("trend_snapshots")
    .select("snapshot_date, mention_count, avg_sentiment_score, growth_metric")
    .eq("topic_id", topicId)
    .order("snapshot_date", { ascending: true })
    .limit(30);

  const articles = (docs ?? []).map((d) => {
    const s = sentMap.get(d.id);
    return {
      id: d.id,
      title: decodeHtmlEntities(d.title),
      url: d.url,
      source: d.source_platform_id ? platName.get(d.source_platform_id) ?? "Unknown" : "Unknown",
      publishedAt: d.published_at,
      snippet: d.summary ? decodeHtmlEntities(d.summary) : null,
      relevance: relMap.get(d.id) ?? 0,
      sentimentLabel: s?.label ?? "neutral",
      sentimentScore: s?.score ?? 0,
    };
  });

  const dateFrom = typeof filters?.date_from === "string" ? filters.date_from : null;
  const dateTo = typeof filters?.date_to === "string" ? filters.date_to : null;
  const dayAgg = new Map<string, { mentions: number; sentSum: number; sentN: number }>();
  for (const d of docs ?? []) {
    const pa = d.published_at;
    if (!pa) continue;
    const day = pa.slice(0, 10);
    if (dateFrom && day < dateFrom) continue;
    if (dateTo && day > dateTo) continue;
    const cur = dayAgg.get(day) ?? { mentions: 0, sentSum: 0, sentN: 0 };
    cur.mentions += 1;
    const s = sentMap.get(d.id);
    if (s) {
      cur.sentSum += s.score;
      cur.sentN += 1;
    }
    dayAgg.set(day, cur);
  }
  const chartArticleTrend = [...dayAgg.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      mentions: v.mentions,
      sentiment: v.sentN ? Number((v.sentSum / v.sentN).toFixed(4)) : null,
    }));

  let pos = 0;
  let neu = 0;
  let neg = 0;
  let sum = 0;
  let n = 0;
  for (const s of sents ?? []) {
    sum += s.score;
    n += 1;
    if (s.label === "positive") pos += 1;
    else if (s.label === "negative") neg += 1;
    else neu += 1;
  }

  const aiSummary = typeof filters?.ai_summary === "string" ? filters.ai_summary : null;
  const rawKeywords = Array.isArray(filters?.keywords) ? (filters.keywords as string[]) : [];
  const keywords = rawKeywords.filter(
    (k) =>
      typeof k === "string" &&
      k.length > 2 &&
      !/nbsp|amp|quot|apos|#[0-9]+|;/i.test(k) &&
      !k.includes("&")
  );

  const snapshotRows = snapshots ?? [];

  return {
    run: {
      id: run.id,
      status: run.status,
      queryText: run.query_text,
      filters: run.filters,
      errorMessage: run.error_message,
      createdAt: run.created_at,
      completedAt: run.completed_at,
      topicId,
      topic: topicRow ?? { name: run.query_text, slug: "" },
    },
    metrics: {
      totalArticles: articles.length,
      positive: pos,
      neutral: neu,
      negative: neg,
      avgSentiment: n ? sum / n : 0,
      growth: snapshotRows.length >= 2 ? snapshotRows[snapshotRows.length - 1]?.growth_metric ?? null : null,
    },
    chartTrend: snapshotRows.map((s) => ({
      date: s.snapshot_date,
      mentions: s.mention_count,
      sentiment: s.avg_sentiment_score,
    })),
    chartArticleTrend,
    chartSentiment: [
      { name: "Positive", value: pos },
      { name: "Neutral", value: neu },
      { name: "Negative", value: neg },
    ],
    relatedTopics: (relatedRows ?? []).map((r) => ({
      id: r.related_topic_id,
      name: relatedName.get(r.related_topic_id) ?? r.related_topic_id,
      score: r.similarity_score,
    })),
    clusters: clusters ?? [],
    articles,
    aiSummary,
    keywords,
  } as unknown as Json;
}
