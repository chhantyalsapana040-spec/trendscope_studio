import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ensureCatalogSourcesInDb } from "@/lib/ensure-catalog-sources";

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await ensureCatalogSourcesInDb();
  } catch {
    /* non-fatal: still return whatever platforms exist */
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin.from("source_platforms").select("id, name, slug, rss_feed_url").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sources: data ?? [] });
}
