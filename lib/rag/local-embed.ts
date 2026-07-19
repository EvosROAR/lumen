const DIMS = 384;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function hashToken(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic local embedding — gratis, tanpa API. */
export function embedLocal(text: string): number[] {
  const vec = new Array<number>(DIMS).fill(0);
  const tokens = tokenize(text);
  if (tokens.length === 0) return vec;

  for (const token of tokens) {
    const h = hashToken(token);
    const idx = h % DIMS;
    const sign = hashToken(`s:${token}`) % 2 === 0 ? 1 : -1;
    // mild TF boost
    vec[idx] += sign;
  }

  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}

export function embedLocalMany(texts: string[]): number[][] {
  return texts.map(embedLocal);
}
