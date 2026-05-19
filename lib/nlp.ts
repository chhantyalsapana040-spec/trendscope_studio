import { decodeHtmlEntities, plainTextForKeywords } from "@/lib/html";

const POS = new Set([
  "good", "great", "best", "better", "growth", "win", "wins", "profit", "gains", "up", "rise", "rises",
  "bullish", "strong", "success", "breakthrough", "innovative", "leading", "optimistic", "surge", "record",
]);
const NEG = new Set([
  "bad", "worst", "loss", "losses", "down", "fall", "falls", "crash", "crisis", "fear", "fears", "bearish",
  "weak", "fail", "failed", "concern", "concerns", "lawsuit", "scandal", "decline", "cut", "cuts", "layoff",
]);

export function cleanText(input: string): string {
  const decoded = plainTextForKeywords(input);
  return decoded
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  return cleanText(text).split(" ").filter((t) => t.length > 2);
}

export function sentimentForText(text: string): { label: "positive" | "neutral" | "negative"; score: number } {
  const tokens = tokenize(text);
  if (tokens.length === 0) return { label: "neutral", score: 0 };
  let pos = 0;
  let neg = 0;
  for (const t of tokens) {
    if (POS.has(t)) pos += 1;
    if (NEG.has(t)) neg += 1;
  }
  const raw = (pos - neg) / Math.max(6, tokens.length * 0.15);
  const score = Math.max(-1, Math.min(1, raw * 3));
  let label: "positive" | "neutral" | "negative" = "neutral";
  if (score > 0.12) label = "positive";
  else if (score < -0.12) label = "negative";
  return { label, score: Number(score.toFixed(4)) };
}

export function relevanceScore(topicTokens: string[], docText: string): number {
  const docTokens = new Set(tokenize(docText));
  if (docTokens.size === 0 || topicTokens.length === 0) return 0;
  let hits = 0;
  for (const tt of topicTokens) {
    if (docTokens.has(tt)) hits += 1;
  }
  return Number((hits / topicTokens.length).toFixed(4));
}

export function extractKeywords(docs: string[], topN = 12): string[] {
  const decoded = docs.map((d) => decodeHtmlEntities(d));
  const freq = new Map<string, number>();
  const stop = new Set([
    "the", "and", "for", "that", "with", "this", "from", "have", "has", "are", "was", "were", "will",
    "into", "about", "your", "their", "they", "them", "its", "our", "you", "not", "but", "can", "all",
    "new", "more", "out", "one", "two", "over", "than", "also", "just", "now", "how", "what", "when",
    "nbsp", "amp", "quot", "apos", "lt", "gt", "ldquo", "rdquo", "mdash", "ndash", "hellip",
  ]);
  for (const d of decoded) {
    for (const t of tokenize(d)) {
      if (stop.has(t)) continue;
      if (t.includes("&") || t.includes(";")) continue;
      if (t.length < 3) continue;
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN).map(([w]) => w);
}

function vec(tokens: string[], vocab: string[]): number[] {
  const bag = new Map<string, number>();
  for (const t of tokens) bag.set(t, (bag.get(t) ?? 0) + 1);
  const norm = Math.sqrt([...bag.values()].reduce((s, n) => s + n * n, 0)) || 1;
  return vocab.map((v) => (bag.get(v) ?? 0) / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return Number(s.toFixed(4));
}

export function tfidfMatrix(docs: string[], vocab: string[]): number[][] {
  const df = new Map<string, number>();
  for (const v of vocab) df.set(v, 0);
  const docTokens = docs.map((d) => tokenize(d));
  for (const tokens of docTokens) {
    const seen = new Set(tokens);
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const N = docs.length || 1;
  return docTokens.map((tokens) => {
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return vocab.map((v) => {
      const idf = Math.log(1 + N / (1 + (df.get(v) ?? 0)));
      return ((tf.get(v) ?? 0) / Math.max(1, tokens.length)) * idf;
    });
  });
}

export function kMeansAssign(vectors: number[][], k: number): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const centroids = vectors.slice(0, Math.min(k, vectors.length)).map((v) => [...v]);
  const assign = new Array(vectors.length).fill(0);
  for (let iter = 0; iter < 12; iter++) {
    for (let i = 0; i < vectors.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        let d = 0;
        for (let j = 0; j < dim; j++) {
          const t = vectors[i][j] - centroids[c][j];
          d += t * t;
        }
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      assign[i] = best;
    }
    for (let c = 0; c < centroids.length; c++) {
      const acc = new Array(dim).fill(0);
      let n = 0;
      for (let i = 0; i < vectors.length; i++) {
        if (assign[i] !== c) continue;
        n += 1;
        for (let j = 0; j < dim; j++) acc[j] += vectors[i][j];
      }
      if (n > 0) for (let j = 0; j < dim; j++) centroids[c][j] = acc[j] / n;
    }
  }
  return assign;
}

export function buildAiSummary(input: {
  topic: string;
  total: number;
  pos: number;
  neu: number;
  neg: number;
  avg: number;
  growth: number | null;
  keywords: string[];
}): string {
  const tone =
    input.avg > 0.15 ? "predominantly positive" : input.avg < -0.15 ? "leaning negative" : "mixed to neutral";
  const growth =
    input.growth == null
      ? "Insufficient historical snapshots were available to quantify week-over-week momentum."
      : `Estimated momentum versus the prior snapshot is approximately ${(input.growth * 100).toFixed(1)}%.`;
  return (
    `TrendScope analysed **${input.topic}** across ${input.total} recent articles. ` +
    `Sentiment is ${tone} (average score ${input.avg.toFixed(2)}), with ${input.pos} positive, ${input.neu} neutral, and ${input.neg} negative items. ` +
    `${growth} ` +
    `Key recurring themes include: ${input.keywords.slice(0, 8).join(", ") || "general market coverage"}.`
  );
}
