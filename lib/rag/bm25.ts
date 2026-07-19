function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export type Bm25Doc = {
  id: string;
  tokens: string[];
};

/** Lightweight BM25 for hybrid retrieval demos (no external deps). */
export function bm25Scores(
  query: string,
  docs: Bm25Doc[],
  opts: { k1?: number; b?: number } = {},
): Map<string, number> {
  const k1 = opts.k1 ?? 1.2;
  const b = opts.b ?? 0.75;
  const qTokens = tokenize(query);
  const scores = new Map<string, number>();
  if (qTokens.length === 0 || docs.length === 0) return scores;

  const N = docs.length;
  const avgdl = docs.reduce((s, d) => s + d.tokens.length, 0) / N;

  const df = new Map<string, number>();
  for (const term of new Set(qTokens)) {
    let count = 0;
    for (const doc of docs) {
      if (doc.tokens.includes(term)) count += 1;
    }
    df.set(term, count);
  }

  for (const doc of docs) {
    const tfMap = new Map<string, number>();
    for (const t of doc.tokens) tfMap.set(t, (tfMap.get(t) || 0) + 1);

    let score = 0;
    for (const term of qTokens) {
      const n = df.get(term) || 0;
      if (n === 0) continue;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const tf = tfMap.get(term) || 0;
      const dl = doc.tokens.length || 1;
      score +=
        idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * dl) / avgdl)));
    }
    scores.set(doc.id, score);
  }

  return scores;
}

export function tokenizeText(text: string) {
  return tokenize(text);
}
