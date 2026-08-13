import { embedModel, embedProvider, getEmbedClient } from "@/lib/openai";
import { embedLocal, embedLocalMany } from "@/lib/rag/local-embed";
import { withRetry } from "@/lib/retry";

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  if (embedProvider() === "local") {
    return embedLocalMany(texts);
  }

  const openai = getEmbedClient();
  const response = await withRetry(
    () =>
      openai.embeddings.create({
        model: embedModel(),
        input: texts,
      }),
    { retries: 3, baseDelayMs: 1500 },
  );

  return response.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

export async function embedQuery(query: string): Promise<number[]> {
  if (embedProvider() === "local") {
    return embedLocal(query);
  }
  const [vector] = await embedTexts([query]);
  return vector;
}
