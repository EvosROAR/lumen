import { NextResponse } from "next/server";
import { isAuthError, requireUser } from "@/lib/auth";
import {
  createUserGoldenCase,
  deleteUserGoldenCase,
  listUserGoldenCases,
} from "@/lib/eval/user-golden";
import { readStore } from "@/lib/rag/store";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth.error;

  try {
    const [cases, store] = await Promise.all([
      listUserGoldenCases(auth.user.id, auth.supabase),
      readStore(auth.user.id, auth.supabase),
    ]);
    return NextResponse.json({
      cases,
      documents: store.documents.map((d) => ({
        id: d.id,
        title: d.title,
        filename: d.filename,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memuat golden set.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth.error;

  try {
    const body = (await request.json()) as {
      question?: string;
      expectedFilenames?: string[];
      expectedAnswerHint?: string;
    };
    const item = await createUserGoldenCase(
      auth.user.id,
      {
        question: body.question || "",
        expectedFilenames: body.expectedFilenames || [],
        expectedAnswerHint: body.expectedAnswerHint,
      },
      auth.supabase,
    );
    return NextResponse.json({ case: item });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menambah kasus.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth.error;

  try {
    const body = (await request.json()) as { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: "id wajib." }, { status: 400 });
    }
    await deleteUserGoldenCase(auth.user.id, body.id, auth.supabase);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menghapus kasus.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
