import type { SupabaseClient } from "@supabase/supabase-js";
import { bm25Scores, tokenizeText } from "@/lib/rag/bm25";
import { cosineSimilarity, embedQuery, embedTexts } from "@/lib/rag/embed";
import { isDemoMode, readStore, replaceChunkEmbeddings } from "@/lib/rag/store";
import type {
  Citation,
  RetrievedChunk,
  RetrievalMode,
} from "@/lib/types";

function normalizeMap(values: Map<string, number>): Map<string, number> {
  const nums = [...values.values()];
  const max = Math.max(...nums, 0);
  const min = Math.min(...nums, 0);
  const span = max - min || 1;
  const out = new Map<string, number>();
  for (const [id, v] of values) {
    out.set(id, (v - min) / span);
  }
  return out;
}

export type RetrieveOptions = {
  topK?: number;
  mode?: RetrievalMode;
  userId: string;
  supabase?: SupabaseClient;
};

export async function retrieve(
  query: string,
  options: RetrieveOptions,
): Promise<{ hits: RetrievedChunk[]; citations: Citation[] }> {
  const topK = options.topK ?? 4;
  const mode = options.mode ?? "hybrid";
  const store = await readStore(options.userId, options.supabase);

  if (store.chunks.length === 0) {
    return { hits: [], citations: [] };
  }

  const queryVector = await embedQuery(query);
  let chunks = store.chunks;

  if (chunks.some((chunk) => chunk.embedding.length !== queryVector.length)) {
    const embeddings = await embedTexts(chunks.map((chunk) => chunk.text));
    chunks = chunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index],
    }));

    if (!isDemoMode()) {
      await replaceChunkEmbeddings(options.userId, chunks, options.supabase);
    }
  }

  const vectorScores = new Map<string, number>();
  for (const chunk of chunks) {
    vectorScores.set(chunk.id, cosineSimilarity(queryVector, chunk.embedding));
  }

  const lexicalScores = bm25Scores(
    query,
    chunks.map((chunk) => ({
      id: chunk.id,
      tokens: tokenizeText(`${chunk.title} ${chunk.text}`),
    })),
  );

  const normVector = normalizeMap(vectorScores);
  const normLexical = normalizeMap(lexicalScores);

  const ranked: RetrievedChunk[] = chunks
    .map((chunk) => {
      const v = normVector.get(chunk.id) || 0;
      const l = normLexical.get(chunk.id) || 0;
      let score = 0;
      if (mode === "vector") score = v;
      else if (mode === "bm25") score = l;
      else score = 0.55 * v + 0.45 * l;
      return { ...chunk, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((hit) => hit.score > 0.08);

  const citations: Citation[] = ranked.map((hit) => ({
    documentId: hit.documentId,
    title: hit.title,
    filename: hit.filename,
    chunkIndex: hit.index,
    score: Number(hit.score.toFixed(4)),
    excerpt: hit.text.slice(0, 280) + (hit.text.length > 280 ? "…" : ""),
  }));

  return { hits: ranked, citations };
}

export function buildContext(hits: RetrievedChunk[]): string {
  if (hits.length === 0) return "";

  return hits
    .map(
      (hit, i) =>
        `[Sumber ${i + 1}] ${hit.title} (${hit.filename}, potongan #${hit.index + 1}, skor ${hit.score.toFixed(3)})\n${hit.text}`,
    )
    .join("\n\n---\n\n");
}
