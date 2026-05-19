import { XMLParser } from "fast-xml-parser";

export interface RssArticle {
  url: string;
  title: string;
  summary: string;
  publishedAt: Date | null;
}

function pickText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "object" && v !== null && "#text" in (v as object)) {
    return String((v as { "#text": unknown })["#text"] ?? "").trim();
  }
  return String(v).trim();
}

function normalizeItems(parsed: Record<string, unknown>): unknown[] {
  const rss = parsed.rss as Record<string, unknown> | undefined;
  const channel = (rss?.channel ?? parsed.feed) as Record<string, unknown> | undefined;
  if (!channel) return [];
  const items = channel.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

export function buildFeedUrl(slug: string, baseUrl: string | null, topicQuery: string): string | null {
  if (!baseUrl) return null;
  if (slug === "google-news") {
    const q = encodeURIComponent(topicQuery);
    return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
  }
  return baseUrl;
}

export async function fetchRssFeed(feedUrl: string, maxItems = 40): Promise<RssArticle[]> {
  const res = await fetch(feedUrl, { next: { revalidate: 300 } });
  if (!res.ok) {
    throw new Error(`RSS fetch failed (${res.status}) for ${feedUrl}`);
  }
  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const items = normalizeItems(parsed);

  const out: RssArticle[] = [];
  for (const raw of items.slice(0, maxItems)) {
    if (!raw || typeof raw !== "object") continue;
    const it = raw as Record<string, unknown>;
    const link = pickText(it.link ?? it.guid);
    const title = pickText(it.title) || "Untitled";
    if (!link || !link.startsWith("http")) continue;
    const summary =
      pickText(it["content:encoded"]) ||
      pickText(it.description) ||
      pickText(it.summary) ||
      "";
    const pub = pickText(it.pubDate) || pickText(it.published) || pickText(it.updated);
    const publishedAt = pub ? new Date(pub) : null;
    out.push({
      url: link.split("?")[0] || link,
      title,
      summary: summary.replace(/<[^>]+>/g, " ").slice(0, 2000),
      publishedAt,
    });
  }
  return out;
}
