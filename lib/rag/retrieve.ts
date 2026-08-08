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
  const out = new Map<string, number>();
  if (nums.length === 0) return out;

  const max = Math.max(...nums);
  const min = Math.min(...nums);

  // All tied (e.g. one chunk, or identical scores): give full relative credit.
  // Otherwise min-max would map every value to 0 and hybrid collapses to ~0.45/0.
  if (max === min) {
    for (const id of values.keys()) out.set(id, 1);
    return out;
  }

  const span = max - min;
  for (const [id, v] of values) {
    out.set(id, (v - min) / span);
  }
  return out;
}

/** Rescale scores so the top hit is 1.0 — display rank strength, not absolute fusion. */
function rescaleTopScores(hits: RetrievedChunk[]): RetrievedChunk[] {
  if (hits.length === 0) return hits;
  const peak = hits[0].score;
  if (peak <= 0) return hits;
  return hits.map((hit) => ({
    ...hit,
    score: hit.score / peak,
  }));
}

/** Match query against indexed filenames (e.g. "baca Akun Surg.txt"). */
export function matchMentionedFilenames(
  query: string,
  filenames: string[],
): string[] {
  const q = query.toLowerCase();
  const matched = new Set<string>();

  for (const name of filenames) {
    const lower = name.toLowerCase();
    const stem = lower.replace(/\.[^.]+$/, "");
    if (q.includes(lower) || (stem.length >= 4 && q.includes(stem))) {
      matched.add(name);
    }
  }

  // Also catch bare "something.txt" patterns even if not in store
  const extHits = query.match(/[\w.\- ()]+\.(txt|md|pdf)/gi) ?? [];
  for (const hit of extHits) {
    const exact = filenames.find(
      (f) => f.toLowerCase() === hit.toLowerCase(),
    );
    if (exact) matched.add(exact);
  }

  return [...matched];
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
): Promise<{
  hits: RetrievedChunk[];
  citations: Citation[];
  availableFilenames: string[];
  mentionedFilenames: string[];
}> {
  const topK = options.topK ?? 4;
  const mode = options.mode ?? "hybrid";
  const store = await readStore(options.userId, options.supabase);
  const availableFilenames = store.documents.map((d) => d.filename);
  const mentionedFilenames = matchMentionedFilenames(query, availableFilenames);

  if (store.chunks.length === 0) {
    return {
      hits: [],
      citations: [],
      availableFilenames,
      mentionedFilenames,
    };
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

  // If user names a file, prefer chunks from that document
  const mentionedSet = new Set(
    mentionedFilenames.map((f) => f.toLowerCase()),
  );
  if (mentionedSet.size > 0) {
    const scoped = chunks.filter((c) =>
      mentionedSet.has(c.filename.toLowerCase()),
    );
    if (scoped.length > 0) chunks = scoped;
  }

  const vectorScores = new Map<string, number>();
  for (const chunk of chunks) {
    vectorScores.set(chunk.id, cosineSimilarity(queryVector, chunk.embedding));
  }

  const lexicalScores = bm25Scores(
    query,
    chunks.map((chunk) => ({
      id: chunk.id,
      tokens: tokenizeText(`${chunk.title} ${chunk.filename} ${chunk.text}`),
    })),
  );

  const normVector = normalizeMap(vectorScores);
  const normLexical = normalizeMap(lexicalScores);

  const ranked: RetrievedChunk[] = rescaleTopScores(
    chunks
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
      .filter((hit) => hit.score > 0.08),
  );

  const citations: Citation[] = ranked.map((hit) => ({
    documentId: hit.documentId,
    title: hit.title,
    filename: hit.filename,
    chunkIndex: hit.index,
    score: Number(hit.score.toFixed(4)),
    excerpt: hit.text.slice(0, 280) + (hit.text.length > 280 ? "…" : ""),
  }));

  return { hits: ranked, citations, availableFilenames, mentionedFilenames };
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
