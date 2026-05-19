import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") ?? "pdf").toLowerCase();

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
  const { data: report, error } = await admin
    .from("saved_reports")
    .select("title, report_json, ai_summary")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bundle = (report.report_json ?? {}) as Record<string, unknown>;

  if (format === "json") {
    return new NextResponse(JSON.stringify(bundle, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="report-${id}.json"`,
      },
    });
  }

  if (format === "csv") {
    const articles = (bundle.articles as Array<Record<string, unknown>> | undefined) ?? [];
    const header = ["title", "source", "publishedAt", "sentimentLabel", "sentimentScore", "url"];
    const lines = [header.join(",")];
    for (const a of articles) {
      const row = header.map((h) => {
        const v = a[h];
        const s = v == null ? "" : String(v).replaceAll('"', '""');
        return `"${s}"`;
      });
      lines.push(row.join(","));
    }
    const csv = lines.join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="report-${id}.csv"`,
      },
    });
  }

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFontSize(16);
  doc.text(report.title, 40, 48);
  doc.setFontSize(10);
  doc.text(String(report.ai_summary ?? ""), 40, 72, { maxWidth: 515 });

  const articles = (bundle.articles as Array<Record<string, unknown>> | undefined) ?? [];
  autoTable(doc, {
    startY: 120,
    head: [["Title", "Source", "Sentiment", "Score"]],
    body: articles.map((a) => [
      String(a.title ?? ""),
      String(a.source ?? ""),
      String(a.sentimentLabel ?? ""),
      String(a.sentimentScore ?? ""),
    ]),
  });

  const out = doc.output("arraybuffer") as ArrayBuffer;
  return new NextResponse(new Uint8Array(out), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="report-${id}.pdf"`,
    },
  });
}
