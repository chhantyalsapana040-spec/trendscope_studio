import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { computeNextCollection } from "@/lib/watchlist-schedule";
import type { TrackingInterval } from "@/types/database.types";

const postSchema = z.object({
  topicId: z.string().uuid(),
  tracking_interval: z.enum(["hourly", "daily", "weekly", "monthly"]),
});

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
  const { data: rows, error } = await admin
    .from("watchlists")
    .select(
      "id, topic_id, tracking_interval, status, last_collected_at, next_collection_at, latest_mention_count, latest_avg_sentiment, trend_movement, updated_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const topicIds = [...new Set((rows ?? []).map((r) => r.topic_id))];
  const { data: topics } =
    topicIds.length > 0
      ? await admin.from("topics").select("id, name, slug").in("id", topicIds)
      : { data: [] as { id: string; name: string; slug: string }[] };
  const topicName = new Map((topics ?? []).map((t) => [t.id, t.name]));

  return NextResponse.json({
    items: (rows ?? []).map((r) => ({
      ...r,
      topic_name: topicName.get(r.topic_id) ?? "Topic",
    })),
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
  const now = new Date();
  const next = computeNextCollection(now, parsed.data.tracking_interval as TrackingInterval);

  const { data, error } = await admin
    .from("watchlists")
    .upsert(
      {
        user_id: user.id,
        topic_id: parsed.data.topicId,
        tracking_interval: parsed.data.tracking_interval,
        status: "active",
        last_collected_at: now.toISOString(),
        next_collection_at: next.toISOString(),
      },
      { onConflict: "user_id,topic_id" }
    )
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ id: data?.id });
}
