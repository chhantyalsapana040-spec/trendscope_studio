import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { runTrendAnalysis } from "@/lib/trend-engine";

const bodySchema = z.object({
  topic: z.string().min(2).max(200),
  category: z.string().min(1),
  dateFrom: z.string(),
  dateTo: z.string(),
  /** Catalog can include many feeds; cap keeps requests bounded. */
  sourceSlugs: z.array(z.string()).min(1).max(40),
});

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

  try {
    const { searchRunId, topicId } = await runTrendAnalysis({
      userId: user.id,
      topicText: parsed.data.topic,
      category: parsed.data.category,
      dateFrom: parsed.data.dateFrom,
      dateTo: parsed.data.dateTo,
      sourceSlugs: parsed.data.sourceSlugs,
    });
    return NextResponse.json({ searchRunId, topicId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
