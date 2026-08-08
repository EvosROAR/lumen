import { NextResponse } from "next/server";
import { isAuthError, requireUser } from "@/lib/auth";
import { runGoldenEval } from "@/lib/eval/run";
import type { RetrievalMode } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth.error;

  const { searchParams } = new URL(request.url);
  const k = Number(searchParams.get("k") || "4");
  const topK = Number.isFinite(k) && k > 0 && k <= 10 ? k : 4;
  const modeParam = searchParams.get("mode") || "hybrid";
  const mode: RetrievalMode =
    modeParam === "vector" || modeParam === "bm25" || modeParam === "hybrid"
      ? modeParam
      : "hybrid";

  try {
    const report = await runGoldenEval({
      userId: auth.user.id,
      supabase: auth.supabase,
      topK,
      mode,
    });
    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Eval gagal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
