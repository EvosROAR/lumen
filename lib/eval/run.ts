import { GOLDEN_CASES } from "@/lib/eval/golden";
import { retrieve } from "@/lib/rag/retrieve";
import { readStore } from "@/lib/rag/store";

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
  documentCount: number;
  chunkCount: number;
  cases: EvalCaseResult[];
  generatedAt: string;
};

export async function runGoldenEval(topK = 4): Promise<EvalReport> {
  const store = await readStore();
  const cases: EvalCaseResult[] = [];

  for (const gold of GOLDEN_CASES) {
    const { citations } = await retrieve(gold.question, topK);
    const retrievedFiles = citations.map((c) => c.filename);
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
    cases.reduce((s, c) => s + c.precisionAtK, 0) / (cases.length || 1);

  return {
    total: cases.length,
    hits,
    recallAtK: Number((hits / (cases.length || 1)).toFixed(3)),
    avgPrecisionAtK: Number(avgPrecisionAtK.toFixed(3)),
    k: topK,
    documentCount: store.documents.length,
    chunkCount: store.chunks.length,
    cases,
    generatedAt: new Date().toISOString(),
  };
}
