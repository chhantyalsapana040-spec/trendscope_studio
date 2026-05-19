import catalog from "@/data/source-catalog.json";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type CatalogSource = {
  name: string;
  slug: string;
  rss_feed_url: string;
  category: string;
};

const rows = catalog as CatalogSource[];

export function getSourceCatalog(): CatalogSource[] {
  return rows;
}

/** Upsert all catalog entries into `source_platforms` (service role). Idempotent. */
export async function ensureCatalogSourcesInDb(): Promise<void> {
  const admin = createServiceRoleClient();
  const { error } = await admin.from("source_platforms").upsert(
    rows.map((s) => ({ name: s.name, slug: s.slug, rss_feed_url: s.rss_feed_url })),
    { onConflict: "slug" }
  );
  if (error) throw error;
}
