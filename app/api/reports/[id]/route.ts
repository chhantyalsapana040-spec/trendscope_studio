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
  const { data: report, error } = await admin
    .from("saved_reports")
    .select("id, title, topic_id, search_run_id, report_json, ai_summary, created_at, updated_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: topic } = await admin.from("topics").select("name, slug").eq("id", report.topic_id).maybeSingle();

  const { data: savedDocs } = await admin
    .from("saved_documents")
    .select("document_id")
    .eq("saved_report_id", id)
    .eq("user_id", user.id);

  const docIds = (savedDocs ?? []).map((d) => d.document_id);
  const { data: docs } =
    docIds.length > 0
      ? await admin
          .from("documents")
          .select("id, url, title, summary, published_at, source_platform_id")
          .in("id", docIds)
      : {
          data: [] as {
            id: string;
            url: string;
            title: string;
            summary: string | null;
            published_at: string | null;
            source_platform_id: string | null;
          }[],
        };

  return NextResponse.json({
    report: {
      ...report,
      topic,
    },
    documents: docs ?? [],
  });
}
