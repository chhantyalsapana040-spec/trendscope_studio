import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  full_name: z.string().min(1).max(120).optional(),
  dashboard_default_category: z.string().min(1).max(64).optional(),
  dashboard_default_date_range: z.string().min(1).max(32).optional(),
  watchlist_default_interval: z.enum(["hourly", "daily", "weekly", "monthly"]).optional(),
  notifications_trend_alerts: z.boolean().optional(),
  export_default_format: z.enum(["pdf", "csv", "json"]).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  data_source_preferences: z.record(z.unknown()).optional(),
});

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
  const { data: profile } = await admin.from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle();
  const { data: settings } = await admin.from("user_settings").select("*").eq("user_id", user.id).maybeSingle();

  return NextResponse.json({
    email: user.email,
    profile: profile ?? { full_name: "", avatar_url: "" },
    settings: settings ?? null,
  });
}

export async function PATCH(req: Request) {
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

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const admin = createServiceRoleClient();

  if (parsed.data.full_name != null) {
    await admin.from("profiles").update({ full_name: parsed.data.full_name }).eq("id", user.id);
  }

  const { full_name: _omit, data_source_preferences, ...restSettings } = parsed.data;

  const settingsUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (restSettings.dashboard_default_category != null) {
    settingsUpdate.dashboard_default_category = restSettings.dashboard_default_category;
  }
  if (restSettings.dashboard_default_date_range != null) {
    settingsUpdate.dashboard_default_date_range = restSettings.dashboard_default_date_range;
  }
  if (restSettings.watchlist_default_interval != null) {
    settingsUpdate.watchlist_default_interval = restSettings.watchlist_default_interval;
  }
  if (restSettings.notifications_trend_alerts != null) {
    settingsUpdate.notifications_trend_alerts = restSettings.notifications_trend_alerts;
  }
  if (restSettings.export_default_format != null) {
    settingsUpdate.export_default_format = restSettings.export_default_format;
  }
  if (restSettings.theme != null) {
    settingsUpdate.theme = restSettings.theme;
  }
  if (data_source_preferences != null) {
    settingsUpdate.data_source_preferences = data_source_preferences;
  }

  const keys = Object.keys(settingsUpdate).filter((k) => k !== "updated_at");
  if (keys.length > 0) {
    const { error } = await admin.from("user_settings").update(settingsUpdate).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
