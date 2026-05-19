import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
  const { data: runs, error } = await admin
    .from("search_runs")
    .select("id, topic_id, created_at, query_text")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(400);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byTopic = new Map<string, { topicId: string; latestRunId: string; label: string; createdAt: string }>();
  for (const r of runs ?? []) {
    if (byTopic.has(r.topic_id)) continue;
    byTopic.set(r.topic_id, {
      topicId: r.topic_id,
      latestRunId: r.id,
      label: r.query_text,
      createdAt: r.created_at,
    });
  }

  const topicIds = [...byTopic.keys()];
  const { data: topics } =
    topicIds.length > 0
      ? await admin.from("topics").select("id, name, slug").in("id", topicIds)
      : { data: [] as { id: string; name: string; slug: string }[] };
  const names = new Map((topics ?? []).map((t) => [t.id, t.name]));

  return NextResponse.json({
    topics: [...byTopic.values()].map((t) => ({
      topicId: t.topicId,
      latestRunId: t.latestRunId,
      name: names.get(t.topicId) ?? t.label,
      createdAt: t.createdAt,
    })),
  });
}
