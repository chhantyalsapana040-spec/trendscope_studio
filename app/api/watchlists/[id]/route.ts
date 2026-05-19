import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { computeNextCollection } from "@/lib/watchlist-schedule";
import type { TrackingInterval } from "@/types/database.types";

const patchSchema = z
  .object({
    tracking_interval: z.enum(["hourly", "daily", "weekly", "monthly"]).optional(),
    status: z.enum(["active", "paused"]).optional(),
  })
  .refine((o) => o.tracking_interval || o.status, { message: "No changes" });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
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
  const { data: row, error: fetchErr } = await admin
    .from("watchlists")
    .select("id, tracking_interval, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (fetchErr || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const nextInterval = (parsed.data.tracking_interval ?? row.tracking_interval) as TrackingInterval;
  const nextStatus = parsed.data.status ?? row.status;
  const now = new Date();
  const nextCollection =
    nextStatus === "active" ? computeNextCollection(now, nextInterval).toISOString() : null;

  const { error } = await admin
    .from("watchlists")
    .update({
      tracking_interval: nextInterval,
      status: nextStatus,
      next_collection_at: nextCollection,
      updated_at: now.toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
  const { error } = await admin.from("watchlists").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
