import { NextResponse } from "next/server";
import { isAuthError, requireUser } from "@/lib/auth";
import { listQueryLogs } from "@/lib/query-logs";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth.error;

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") || "100");
  const safeLimit =
    Number.isFinite(limit) && limit > 0 && limit <= 500 ? limit : 100;

  try {
    const logs = await listQueryLogs(auth.user.id, auth.supabase, safeLimit);
    const avgTotal =
      logs.reduce((s, l) => s + l.totalMs, 0) / (logs.length || 1);
    const avgRetrieve =
      logs.reduce((s, l) => s + l.retrieveMs, 0) / (logs.length || 1);
    const avgCitations =
      logs.reduce((s, l) => s + l.citationCount, 0) / (logs.length || 1);

    return NextResponse.json({
      logs,
      summary: {
        count: logs.length,
        avgTotalMs: Number(avgTotal.toFixed(1)),
        avgRetrieveMs: Number(avgRetrieve.toFixed(1)),
        avgCitationCount: Number(avgCitations.toFixed(2)),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memuat metrics.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
