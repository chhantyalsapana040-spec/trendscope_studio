import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
  const { data: doc, error } = await admin
    .from("documents")
    .select("id, url, title, summary, content_preview, published_at, source_platform_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: plat } = doc.source_platform_id
    ? await admin.from("source_platforms").select("name, slug").eq("id", doc.source_platform_id).maybeSingle()
    : { data: null };

  const { data: sent } = await admin.from("document_sentiments").select("label, score").eq("document_id", id).maybeSingle();

  return NextResponse.json({
    document: {
      ...doc,
      source: plat?.name ?? "Unknown",
      sentimentLabel: sent?.label ?? "neutral",
      sentimentScore: sent?.score ?? 0,
    },
  });
}
