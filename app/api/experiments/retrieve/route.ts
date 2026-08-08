import { NextResponse } from "next/server";
import { isAuthError, requireUser } from "@/lib/auth";
import { resolveGoldenCases } from "@/lib/eval/user-golden";
import { insertQueryLog } from "@/lib/query-logs";
import { retrieve } from "@/lib/rag/retrieve";
import { readStore } from "@/lib/rag/store";
import type { RetrievalMode } from "@/lib/types";

export const runtime = "nodejs";

const MODES: RetrievalMode[] = ["vector", "bm25", "hybrid"];

function scoreAgainstGolden(
  query: string,
  filenames: string[],
  topK: number,
  goldenCases: { id: string; question: string; expectedFilenames: string[] }[],
) {
  const gold = goldenCases.find(
    (g) => g.question.toLowerCase() === query.trim().toLowerCase(),
  );
  if (!gold) return null;
  const relevant = filenames.filter((f) => gold.expectedFilenames.includes(f));
  const hit = relevant.length > 0;
  const precisionAtK =
    filenames.length === 0 ? 0 : relevant.length / filenames.length;
  return {
    matchedGoldenId: gold.id,
    expectedFilenames: gold.expectedFilenames,
    hit,
    recallAtK: hit ? 1 : 0,
    precisionAtK: Number(precisionAtK.toFixed(3)),
    k: topK,
  };
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth.error;

  try {
    const body = (await request.json()) as {
      query?: string;
      topK?: number;
      runGoldenCompare?: boolean;
    };
    const query = body.query?.trim();
    if (!query) {
      return NextResponse.json({ error: "query wajib." }, { status: 400 });
    }
    const topK =
      typeof body.topK === "number" && body.topK > 0 && body.topK <= 10
        ? body.topK
        : 4;

    const store = await readStore(auth.user.id, auth.supabase);
    const resolved = await resolveGoldenCases(
      auth.user.id,
      store,
      auth.supabase,
    );

    const started = Date.now();
    const results = await Promise.all(
      MODES.map(async (mode) => {
        const modeStarted = Date.now();
        const { citations } = await retrieve(query, {
          topK,
          mode,
          userId: auth.user.id,
          supabase: auth.supabase,
        });
        const retrieveMs = Date.now() - modeStarted;
        const filenames = citations.map((c) => c.filename);
        return {
          mode,
          retrieveMs,
          citations,
          golden: scoreAgainstGolden(query, filenames, topK, resolved.cases),
        };
      }),
    );

    let goldenReports = null;
    if (body.runGoldenCompare) {
      if (resolved.cases.length === 0) {
        return NextResponse.json(
          {
            error:
              resolved.message ||
              "Belum ada golden set. Tambah pertanyaan di /eval dulu.",
          },
          { status: 400 },
        );
      }
      goldenReports = await Promise.all(
        MODES.map(async (mode) => {
          const cases = [];
          for (const gold of resolved.cases) {
            const { citations } = await retrieve(gold.question, {
              topK,
              mode,
              userId: auth.user.id,
              supabase: auth.supabase,
            });
            const relevant = citations.filter((c) =>
              gold.expectedFilenames.includes(c.filename),
            );
            cases.push({
              id: gold.id,
              hit: relevant.length > 0,
              precisionAtK:
                citations.length === 0
                  ? 0
                  : relevant.length / citations.length,
            });
          }
          const hits = cases.filter((c) => c.hit).length;
          const avgPrecisionAtK =
            cases.reduce((s, c) => s + c.precisionAtK, 0) / (cases.length || 1);
          return {
            mode,
            recallAtK: Number((hits / (cases.length || 1)).toFixed(3)),
            avgPrecisionAtK: Number(avgPrecisionAtK.toFixed(3)),
            hits,
            total: cases.length,
            k: topK,
            source: resolved.source,
          };
        }),
      );
    }

    const totalMs = Date.now() - started;
    const hybrid = results.find((r) => r.mode === "hybrid");
    if (hybrid) {
      await insertQueryLog(
        auth.user.id,
        {
          conversationId: null,
          query,
          retrievalMode: "experiment",
          retrieveMs: totalMs,
          generateMs: 0,
          totalMs,
          topK,
          citationCount: hybrid.citations.length,
          citationFilenames: hybrid.citations.map((c) => c.filename),
        },
        auth.supabase,
      );
    }

    return NextResponse.json({
      query,
      topK,
      totalMs,
      results,
      goldenReports,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Eksperimen gagal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
