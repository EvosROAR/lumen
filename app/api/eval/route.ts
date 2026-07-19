import { NextResponse } from "next/server";
import { runGoldenEval } from "@/lib/eval/run";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const k = Number(searchParams.get("k") || "4");
  const topK = Number.isFinite(k) && k > 0 && k <= 10 ? k : 4;

  try {
    const report = await runGoldenEval(topK);
    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Eval gagal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
