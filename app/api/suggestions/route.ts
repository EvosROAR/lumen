import { NextResponse } from "next/server";
import { isAuthError, requireUser } from "@/lib/auth";
import { listUserGoldenCases } from "@/lib/eval/user-golden";
import { readStore } from "@/lib/rag/store";
import { buildQuerySuggestions } from "@/lib/suggestions";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth.error;

  try {
    const [cases, store] = await Promise.all([
      listUserGoldenCases(auth.user.id, auth.supabase),
      readStore(auth.user.id, auth.supabase),
    ]);

    const suggestions = buildQuerySuggestions({
      goldenQuestions: cases.map((c) => c.question),
      documents: store.documents.map((d) => ({
        title: d.title,
        filename: d.filename,
      })),
    });

    return NextResponse.json({
      suggestions,
      source: cases.length > 0 ? "golden" : store.documents.length > 0 ? "documents" : "empty",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memuat saran pertanyaan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
