import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveGoldenCases } from "@/lib/eval/user-golden";
import { retrieve } from "@/lib/rag/retrieve";
import { readStore } from "@/lib/rag/store";
import type { RetrievalMode } from "@/lib/types";

export type EvalCaseResult = {
  id: string;
  question: string;
  expectedFilenames: string[];
  hit: boolean;
  precisionAtK: number;
  retrieved: { title: string; filename: string; score: number }[];
};

export type EvalReport = {
  total: number;
  hits: number;
  recallAtK: number;
  avgPrecisionAtK: number;
  k: number;
  mode: RetrievalMode;
  documentCount: number;
  chunkCount: number;
  cases: EvalCaseResult[];
  generatedAt: string;
  source: "custom" | "sample" | "none";
  message: string | null;
  availableFilenames: string[];
};

export async function runGoldenEval(opts: {
  userId: string;
  supabase?: SupabaseClient;
  topK?: number;
  mode?: RetrievalMode;
}): Promise<EvalReport> {
  const topK = opts.topK ?? 4;
  const mode = opts.mode ?? "hybrid";
  const store = await readStore(opts.userId, opts.supabase);
  const resolved = await resolveGoldenCases(
    opts.userId,
    store,
    opts.supabase,
  );
  const cases: EvalCaseResult[] = [];

  for (const gold of resolved.cases) {
    const { citations } = await retrieve(gold.question, {
      topK,
      mode,
      userId: opts.userId,
      supabase: opts.supabase,
    });
    const relevantRetrieved = citations.filter((c) =>
      gold.expectedFilenames.includes(c.filename),
    );
    const hit = relevantRetrieved.length > 0;
    const precisionAtK =
      citations.length === 0 ? 0 : relevantRetrieved.length / citations.length;

    cases.push({
      id: gold.id,
      question: gold.question,
      expectedFilenames: gold.expectedFilenames,
      hit,
      precisionAtK: Number(precisionAtK.toFixed(3)),
      retrieved: citations.map((c) => ({
        title: c.title,
        filename: c.filename,
        score: c.score,
      })),
    });
  }

  const hits = cases.filter((c) => c.hit).length;
  const avgPrecisionAtK =
    cases.length === 0
      ? 0
      : cases.reduce((s, c) => s + c.precisionAtK, 0) / cases.length;

  return {
    total: cases.length,
    hits,
    recallAtK: Number((hits / (cases.length || 1)).toFixed(3)),
    avgPrecisionAtK: Number(avgPrecisionAtK.toFixed(3)),
    k: topK,
    mode,
    documentCount: store.documents.length,
    chunkCount: store.chunks.length,
    cases,
    generatedAt: new Date().toISOString(),
    source: resolved.source,
    message: resolved.message,
    availableFilenames: resolved.availableFilenames,
  };
}
