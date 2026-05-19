from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Tuple
from urllib.parse import quote

import feedparser
from dateutil import parser as dateparser
from supabase import Client, create_client
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

analyzer = SentimentIntensityAnalyzer()


def sb() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def sentiment_label(compound: float) -> Tuple[str, float]:
    if compound >= 0.05:
        return "positive", float(compound)
    if compound <= -0.05:
        return "negative", float(compound)
    return "neutral", float(compound)


def fetch_feed(url: str, limit: int = 30) -> List[Dict[str, Any]]:
    parsed = feedparser.parse(url)
    out: List[Dict[str, Any]] = []
    for e in parsed.entries[:limit]:
        link = e.get("link")
        if not link and str(e.get("id", "")).startswith("http"):
            link = str(e.get("id"))
        if not link:
            continue
        title = e.get("title", "Untitled")
        summary = e.get("summary", e.get("description", "")) or ""
        published = None
        if e.get("published"):
            try:
                published = dateparser.parse(e["published"])
            except Exception:
                published = None
        out.append({"url": link.split("?")[0], "title": title, "summary": summary[:2000], "published_at": published})
    return out


def upsert_document_id(client: Client, row: Dict[str, Any]) -> str:
    payload = {
        "url": row["url"],
        "title": row["title"],
        "summary": row["summary"][:800],
        "content_preview": row["summary"][:1500],
        "source_platform_id": row.get("source_platform_id"),
        "published_at": row["published_at"].isoformat() if row.get("published_at") else None,
    }
    res = client.table("documents").upsert(payload, on_conflict="url").select("id").execute()
    if res.data:
        return res.data[0]["id"]
    sel = client.table("documents").select("id").eq("url", row["url"]).limit(1).execute()
    if not sel.data:
        raise RuntimeError("document upsert failed")
    return sel.data[0]["id"]


def process_watchlist_row(client: Client, wl: Dict[str, Any]) -> None:
    topic_id = wl["topic_id"]
    topic = client.table("topics").select("name").eq("id", topic_id).single().execute().data
    topic_name = topic["name"]

    platforms = client.table("source_platforms").select("id, slug, rss_feed_url").execute().data or []
    collected: List[Dict[str, Any]] = []
    for p in platforms:
        base = p.get("rss_feed_url")
        if not base:
            continue
        url = f"https://news.google.com/rss/search?q={quote(topic_name)}&hl=en-US&gl=US&ceid=US:en" if p["slug"] == "google-news" else base
        try:
            for art in fetch_feed(url, 20):
                art["source_platform_id"] = p["id"]
                collected.append(art)
        except Exception:
            continue

    dedup: Dict[str, Dict[str, Any]] = {}
    for a in collected:
        dedup.setdefault(a["url"], a)

    doc_ids: List[str] = []
    scores: List[float] = []
    pos = neu = neg = 0

    for art in dedup.values():
        blob = f"{art['title']} {art['summary']}"
        compound = analyzer.polarity_scores(blob)["compound"]
        label, score = sentiment_label(compound)
        scores.append(score)
        if label == "positive":
            pos += 1
        elif label == "negative":
            neg += 1
        else:
            neu += 1

        doc_id = upsert_document_id(client, art)
        doc_ids.append(doc_id)

        client.table("document_topics").upsert(
            {"document_id": doc_id, "topic_id": topic_id, "relevance_score": 0.2},
            on_conflict="document_id,topic_id",
        ).execute()

        client.table("document_sentiments").upsert(
            {"document_id": doc_id, "label": label, "score": score, "model_version": "v1-python"},
            on_conflict="document_id",
        ).execute()

    today = datetime.now(timezone.utc).date().isoformat()
    existing = (
        client.table("trend_snapshots")
        .select("mention_count, positive_count, neutral_count, negative_count")
        .eq("topic_id", topic_id)
        .eq("snapshot_date", today)
        .limit(1)
        .execute()
        .data
        or []
    )
    base = existing[0] if existing else {"mention_count": 0, "positive_count": 0, "neutral_count": 0, "negative_count": 0}

    avg = sum(scores) / len(scores) if scores else None
    client.table("trend_snapshots").upsert(
        {
            "topic_id": topic_id,
            "snapshot_date": today,
            "mention_count": int(base["mention_count"]) + len(doc_ids),
            "positive_count": int(base["positive_count"]) + pos,
            "neutral_count": int(base["neutral_count"]) + neu,
            "negative_count": int(base["negative_count"]) + neg,
            "avg_sentiment_score": float(avg) if avg is not None else None,
        },
        on_conflict="topic_id,snapshot_date",
    ).execute()

    now = datetime.now(timezone.utc)
    hours = {"hourly": 1, "daily": 24, "weekly": 24 * 7, "monthly": 24 * 30}[wl["tracking_interval"]]
    next_at = (now + timedelta(hours=hours)).isoformat()

    client.table("watchlists").update(
        {
            "last_collected_at": now.isoformat(),
            "next_collection_at": next_at,
            "latest_mention_count": len(doc_ids),
            "latest_avg_sentiment": float(avg) if avg is not None else None,
            "trend_movement": "updated",
        }
    ).eq("id", wl["id"]).execute()


def main() -> None:
    client = sb()
    now = datetime.now(timezone.utc).isoformat()
    due = client.table("watchlists").select("*").eq("status", "active").lte("next_collection_at", now).limit(25).execute().data or []
    for wl in due:
        try:
            process_watchlist_row(client, wl)
        except Exception as exc:  # noqa: BLE001
            print("watchlist failed", wl.get("id"), exc)


if __name__ == "__main__":
    main()
