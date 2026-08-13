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

/** Match query against indexed filenames (e.g. "baca Akun Surg.txt" or "project plan"). */
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

  // Partial title: "project plan" → "Project Plan - Aplikasi ERP….pdf"
  const stop = new Set([
    "dokumen",
    "document",
    "file",
    "yang",
    "itu",
    "ini",
    "tsb",
    "tersebut",
    "bisa",
    "tolong",
    "mohon",
    "jelaskan",
    "menjelaskan",
    "rinci",
    "secara",
    "kepada",
    "saya",
    "apa",
    "isi",
    "ada",
    "dengan",
    "dari",
    "untuk",
    "the",
    "and",
    "pdf",
    "txt",
    "md",
  ]);
  const significant = (text: string) =>
    text
      .toLowerCase()
      .replace(/\.[^.]+$/, "")
      .split(/[^a-z0-9]+/i)
      .filter((t) => t.length >= 4 && !stop.has(t));

  for (const name of filenames) {
    if (matched.has(name)) continue;
    const tokens = significant(name);
    const hits = tokens.filter((t) => q.includes(t));
    if (hits.length >= 2) {
      matched.add(name);
      continue;
    }
    if (hits.length === 1 && hits[0].length >= 5) {
      const tok = hits[0];
      const unique = !filenames.some(
        (f) =>
          f !== name &&
          significant(f).includes(tok),
      );
      if (unique) matched.add(name);
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

const DEIXIS_RE =
  /\b(tsb\.?|tersebut|yang\s+tadi)\b/i;

/** When user says "dokumen tsb" / "project plan itu", pull filenames from query + history. */
export function resolveQueryHints(
  query: string,
  historyTexts: string[],
  availableFilenames: string[],
): { retrievalQuery: string; hintFilenames: string[] } {
  const direct = matchMentionedFilenames(query, availableFilenames);
  if (direct.length > 0) {
    return {
      retrievalQuery: `${query}\n${direct.join(" ")}`,
      hintFilenames: direct,
    };
  }

  const fromHistory: string[] = [];
  const seen = new Set<string>();
  for (const text of historyTexts) {
    for (const name of matchMentionedFilenames(text, availableFilenames)) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      fromHistory.push(name);
    }
  }

  const asksAboutDoc =
    DEIXIS_RE.test(query) ||
    /\b(dokumen|file|pdf)\b/i.test(query) ||
    /\b(isi|jelaskan|menjelaskan|rangkum|ringkas|rinci)\b/i.test(query);

  if (fromHistory.length > 0 && asksAboutDoc) {
    return {
      retrievalQuery: `${query}\n${fromHistory.join(" ")}`,
      hintFilenames: fromHistory,
    };
  }

  if (
    availableFilenames.length === 1 &&
    /\b(dokumen|file|pdf)\b/i.test(query)
  ) {
    return {
      retrievalQuery: `${query}\n${availableFilenames[0]}`,
      hintFilenames: availableFilenames,
    };
  }

  return { retrievalQuery: query, hintFilenames: [] };
}

export type RetrieveOptions = {
  topK?: number;
  mode?: RetrievalMode;
  userId: string;
  supabase?: SupabaseClient;
  /** Extra filenames to scope (e.g. resolved from "dokumen tsb"). */
  hintFilenames?: string[];
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
  const mentionedFilenames = [
    ...new Set([
      ...matchMentionedFilenames(query, availableFilenames),
      ...(options.hintFilenames ?? []).filter((f) =>
        availableFilenames.some((a) => a.toLowerCase() === f.toLowerCase()),
      ),
    ]),
  ];

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

  let ranked: RetrievedChunk[] = rescaleTopScores(
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
      // When a file is explicitly targeted, keep top chunks even if absolute scores are low.
      .filter((hit) => (mentionedSet.size > 0 ? true : hit.score > 0.08)),
  );

  // Named/hinted file exists but ranking empty — use leading chunks of that file.
  if (ranked.length === 0 && mentionedSet.size > 0) {
    ranked = chunks
      .filter((c) => mentionedSet.has(c.filename.toLowerCase()))
      .sort((a, b) => a.index - b.index)
      .slice(0, topK)
      .map((chunk, i) => ({ ...chunk, score: Math.max(0.5, 1 - i * 0.05) }));
  }

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
