import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { buildSearchRunBundle } from "@/lib/search-run-bundle";

const MAX_RUNS = 35;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
  const { data: wl, error } = await admin
    .from("watchlists")
    .select(
      "id, topic_id, tracking_interval, status, last_collected_at, next_collection_at, latest_mention_count, latest_avg_sentiment, trend_movement, updated_at"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !wl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: topic } = await admin.from("topics").select("id, name, slug").eq("id", wl.topic_id).maybeSingle();

  const { data: runRows } = await admin
    .from("search_runs")
    .select("id, completed_at, created_at, query_text, status, filters")
    .eq("user_id", user.id)
    .eq("topic_id", wl.topic_id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(MAX_RUNS);

  const runs = [];
  for (const row of runRows ?? []) {
    const bundle = await buildSearchRunBundle(admin, user.id, row.id);
    runs.push({
      id: row.id,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      queryText: row.query_text,
      status: row.status,
      filters: row.filters,
      bundle,
    });
  }

  const latestRun = runs[0]
    ? { id: runs[0].id, completed_at: runs[0].completedAt, query_text: runs[0].queryText, status: runs[0].status }
    : null;

  return NextResponse.json({
    watchlist: wl,
    topic: topic ?? { id: wl.topic_id, name: "Topic", slug: "" },
    latestRun,
    runs,
    /** @deprecated use runs[0].bundle */
    bundle: runs[0]?.bundle ?? null,
  });
}
