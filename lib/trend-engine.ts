import { formatISO, startOfDay } from "date-fns";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import {
  buildAiSummary,
  extractKeywords,
  kMeansAssign,
  relevanceScore,
  sentimentForText,
  tfidfMatrix,
  tokenize,
} from "@/lib/nlp";
import { buildFeedUrl, fetchRssFeed, type RssArticle } from "@/lib/rss";
import { decodeHtmlEntities } from "@/lib/html";
import { ensureCatalogSourcesInDb } from "@/lib/ensure-catalog-sources";
import { slugify } from "@/lib/utils";

export interface AnalyseInput {
  userId: string;
  topicText: string;
  category: string;
  dateFrom: string;
  dateTo: string;
  sourceSlugs: string[];
}

const CATEGORY_HINTS: Record<string, string[]> = {
  all: [],
  technology: ["tech", "software", "ai", "chip", "cloud", "data", "apple", "google", "microsoft"],
  business: ["market", "economy", "finance", "bank", "trade", "ceo", "earnings", "stock"],
  science: ["science", "research", "study", "lab", "space", "climate", "energy"],
  media: ["media", "film", "tv", "music", "streaming", "hollywood"],
};

function categoryMatch(category: string, text: string): boolean {
  if (category === "all") return true;
  const hints = CATEGORY_HINTS[category] ?? [];
  if (hints.length === 0) return true;
  const t = text.toLowerCase();
  return hints.some((h) => t.includes(h));
}

function inDateRange(d: Date | null, from: Date, to: Date): boolean {
  if (!d || Number.isNaN(d.getTime())) return true;
  return d >= from && d <= to;
}

export async function runTrendAnalysis(input: AnalyseInput): Promise<{ searchRunId: string; topicId: string }> {
  const admin = createServiceRoleClient();
  await ensureCatalogSourcesInDb();
  const slug = slugify(input.topicText);
  const from = startOfDay(new Date(input.dateFrom));
  const to = startOfDay(new Date(input.dateTo));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("Invalid date range");
  }

  const { data: topicRow, error: topicErr } = await admin
    .from("topics")
    .upsert({ name: input.topicText.trim(), slug }, { onConflict: "slug" })
    .select("id")
    .single();
  if (topicErr || !topicRow) throw topicErr ?? new Error("Topic upsert failed");

  const filters: Json = {
    category: input.category,
    date_from: formatISO(from, { representation: "date" }),
    date_to: formatISO(to, { representation: "date" }),
    source_slugs: input.sourceSlugs,
  };

  const { data: runRow, error: runErr } = await admin
    .from("search_runs")
    .insert({
      user_id: input.userId,
      topic_id: topicRow.id,
      query_text: input.topicText.trim(),
      status: "processing",
      filters,
    })
    .select("id")
    .single();
  if (runErr || !runRow) throw runErr ?? new Error("search_runs insert failed");

  const searchRunId = runRow.id;
  const topicId = topicRow.id;

  try {
    const { data: jobRow } = await admin
      .from("processing_jobs")
      .insert({
        job_type: "analyse_trend",
        status: "running",
        search_run_id: searchRunId,
        payload: filters,
      })
      .select("id")
      .single();
    const processingJobId = jobRow?.id;

    const { data: platforms, error: platErr } = await admin
      .from("source_platforms")
      .select("id, slug, rss_feed_url")
      .in("slug", input.sourceSlugs.length ? input.sourceSlugs : ["techcrunch"]);
    if (platErr) throw platErr;

    const collected: RssArticle[] = [];
    for (const p of platforms ?? []) {
      const url = buildFeedUrl(p.slug, p.rss_feed_url, input.topicText.trim());
      if (!url) continue;
      try {
        const items = await fetchRssFeed(url, 45);
        for (const it of items) {
          collected.push(it);
        }
      } catch {
        /* skip broken feeds */
      }
    }

    const dedup = new Map<string, RssArticle>();
    for (const a of collected) {
      if (!dedup.has(a.url)) dedup.set(a.url, a);
    }

    const topicTokens = tokenize(input.topicText);
    const scored: Array<RssArticle & { relevance: number }> = [];
    for (const a of dedup.values()) {
      if (!inDateRange(a.publishedAt, from, to)) continue;
      const blob = `${a.title} ${a.summary}`;
      if (!categoryMatch(input.category, blob)) continue;
      const relevance = relevanceScore(topicTokens, blob);
      if (relevance < 0.04) continue;
      scored.push({ ...a, relevance });
    }
    scored.sort((x, y) => y.relevance - x.relevance);
    const limited = scored.slice(0, 140);

    const docIds: string[] = [];
    const docTexts: string[] = [];

    for (const art of limited) {
      const sent = sentimentForText(`${art.title} ${art.summary}`);
      const plat = (platforms ?? []).find((pl) => {
        const u = buildFeedUrl(pl.slug, pl.rss_feed_url, input.topicText.trim());
        return u && art.url.startsWith(new URL(u).origin);
      });
      const sourceId = plat?.id ?? (platforms?.[0]?.id ?? null);

      const { data: doc, error: dErr } = await admin
        .from("documents")
        .upsert(
          {
            url: art.url,
            title: decodeHtmlEntities(art.title),
            summary: decodeHtmlEntities(art.summary).slice(0, 800),
            content_preview: decodeHtmlEntities(art.summary).slice(0, 1500),
            source_platform_id: sourceId,
            published_at: art.publishedAt ? art.publishedAt.toISOString() : null,
          },
          { onConflict: "url" }
        )
        .select("id")
        .single();
      if (dErr || !doc) continue;

      docIds.push(doc.id);
      docTexts.push(`${art.title} ${art.summary}`);

      await admin.from("document_topics").upsert(
        {
          document_id: doc.id,
          topic_id: topicId,
          relevance_score: art.relevance,
        },
        { onConflict: "document_id,topic_id" }
      );

      await admin.from("document_sentiments").upsert(
        {
          document_id: doc.id,
          label: sent.label,
          score: sent.score,
          model_version: "v1",
        },
        { onConflict: "document_id" }
      );
    }

    let filteredSents: { label: string; score: number }[] = [];
    if (docIds.length > 0) {
      const { data: sentiments } = await admin
        .from("document_sentiments")
        .select("label, score")
        .in("document_id", docIds);
      filteredSents = sentiments ?? [];
    }

    let pos = 0;
    let neu = 0;
    let neg = 0;
    let sum = 0;
    for (const s of filteredSents) {
      sum += s.score;
      if (s.label === "positive") pos += 1;
      else if (s.label === "negative") neg += 1;
      else neu += 1;
    }
    const total = filteredSents.length;
    const avg = total ? sum / total : 0;

    const today = formatISO(from, { representation: "date" });
    const { data: existingSnap } = await admin
      .from("trend_snapshots")
      .select("id, mention_count, positive_count, neutral_count, negative_count")
      .eq("topic_id", topicId)
      .eq("snapshot_date", today)
      .maybeSingle();

    const baseM = existingSnap?.mention_count ?? 0;
    const baseP = existingSnap?.positive_count ?? 0;
    const baseN = existingSnap?.neutral_count ?? 0;
    const baseG = existingSnap?.negative_count ?? 0;

    await admin.from("trend_snapshots").upsert(
      {
        topic_id: topicId,
        snapshot_date: today,
        mention_count: baseM + total,
        positive_count: baseP + pos,
        neutral_count: baseN + neu,
        negative_count: baseG + neg,
        avg_sentiment_score: Number(avg.toFixed(4)),
        growth_metric: null,
      },
      { onConflict: "topic_id,snapshot_date" }
    );

    const { data: prior } = await admin
      .from("trend_snapshots")
      .select("mention_count, snapshot_date")
      .eq("topic_id", topicId)
      .lt("snapshot_date", today)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    let growth: number | null = null;
    if (prior?.mention_count && prior.mention_count > 0) {
      growth = (baseM + total - prior.mention_count) / prior.mention_count;
      await admin
        .from("trend_snapshots")
        .update({ growth_metric: Number(growth.toFixed(4)) })
        .eq("topic_id", topicId)
        .eq("snapshot_date", today);
    }

    const keywords = extractKeywords(docTexts, 14);

    let otherLinks: { topic_id: string }[] = [];
    if (docIds.length > 0) {
      const { data } = await admin
        .from("document_topics")
        .select("topic_id")
        .in("document_id", docIds)
        .neq("topic_id", topicId);
      otherLinks = data ?? [];
    }

    const freq = new Map<string, number>();
    for (const row of otherLinks) {
      freq.set(row.topic_id, (freq.get(row.topic_id) ?? 0) + 1);
    }
    const topRelated = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    for (const [tid, c] of topRelated) {
      const max = topRelated[0]?.[1] ?? 1;
      await admin.from("related_topics").insert({
        search_run_id: searchRunId,
        topic_id: topicId,
        related_topic_id: tid,
        similarity_score: Number((c / max).toFixed(4)),
      });
    }

    const vocab = extractKeywords(docTexts, 24);
    if (docTexts.length > 0 && docIds.length === docTexts.length) {
      const matrix = tfidfMatrix(docTexts, vocab);
      const k = Math.min(4, Math.max(1, Math.floor(Math.sqrt(docTexts.length))));
      const assign = kMeansAssign(matrix, k);
      const clusters = new Map<number, string[]>();
      for (let i = 0; i < assign.length; i++) {
        const key = assign[i];
        if (!clusters.has(key)) clusters.set(key, []);
        clusters.get(key)!.push(docIds[i]);
      }

      let idx = 0;
      for (const [, ids] of clusters) {
        const label = `Cluster ${idx + 1}`;
        const { data: cl } = await admin
          .from("topic_clusters")
          .insert({ search_run_id: searchRunId, label, cluster_index: idx })
          .select("id")
          .single();
        idx += 1;
        if (!cl) continue;
        for (const did of ids) {
          await admin.from("topic_cluster_members").insert({
            topic_cluster_id: cl.id,
            document_id: did,
          });
        }
      }
    }

    const summary = buildAiSummary({
      topic: input.topicText.trim(),
      total,
      pos,
      neu,
      neg,
      avg,
      growth,
      keywords,
    });

    const mergedFilters: Json = {
      ...(typeof filters === "object" && filters !== null ? filters : {}),
      ai_summary: summary,
      keywords,
      document_ids: docIds,
    } as Json;

    await admin
      .from("search_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        filters: mergedFilters,
      })
      .eq("id", searchRunId);

    if (processingJobId) {
      await admin
        .from("processing_jobs")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", processingJobId);
    }

    return { searchRunId, topicId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analysis failed";
    await admin
      .from("search_runs")
      .update({ status: "failed", error_message: msg, completed_at: new Date().toISOString() })
      .eq("id", searchRunId);
    await admin
      .from("processing_jobs")
      .update({ status: "failed", error_message: msg, updated_at: new Date().toISOString() })
      .eq("search_run_id", searchRunId)
      .eq("status", "running");
    throw e;
  }
}
