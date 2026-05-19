/**
 * Decode common HTML entities and strip tags for plain-text NLP / display.
 */

const NAMED: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  ldquo: "\u201c",
  rdquo: "\u201d",
  lsquo: "\u2018",
  rsquo: "\u2019",
  mdash: "\u2014",
  ndash: "\u2013",
  hellip: "\u2026",
};

export function decodeHtmlEntities(input: string): string {
  if (!input) return "";
  let s = input.replace(/<[^>]+>/g, " ");
  s = s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (full, ent: string) => {
    if (ent[0] === "#" && ent[1] === "x") {
      const code = Number.parseInt(ent.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    if (ent[0] === "#") {
      const code = Number.parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    return NAMED[ent.toLowerCase()] ?? full;
  });
  return s.replace(/\s+/g, " ").trim();
}

export function plainTextForKeywords(input: string): string {
  return decodeHtmlEntities(input).toLowerCase();
}
