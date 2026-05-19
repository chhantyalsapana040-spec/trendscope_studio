export const REPORT_KIND_ANALYSIS = "analysis_report";
export const REPORT_KIND_TOPIC_ARTICLES = "topic_article_save";

export function reportKindFromJson(reportJson: unknown): string | null {
  if (!reportJson || typeof reportJson !== "object") return null;
  const k = (reportJson as Record<string, unknown>).kind;
  return typeof k === "string" ? k : null;
}
