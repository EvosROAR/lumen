import { NextResponse } from "next/server";
import { isAuthError, requireUser } from "@/lib/auth";
import { deleteDocument } from "@/lib/rag/ingest";
import { hasChatKey } from "@/lib/openai";
import {
  isDemoMode,
  readStore,
  usingSupabaseStore,
} from "@/lib/rag/store";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth.error;

  const store = await readStore(auth.user.id, auth.supabase);
  return NextResponse.json({
    configured: hasChatKey(),
    demoMode: isDemoMode(),
    storage: usingSupabaseStore() ? "supabase" : "file",
    user: { id: auth.user.id, email: auth.user.email },
    documents: store.documents,
    chunkCount: store.chunks.length,
  });
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth.error;

  if (isDemoMode()) {
    return NextResponse.json(
      { error: "Mode demo read-only: hapus dokumen dinonaktifkan." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "id wajib." }, { status: 400 });
  }
  await deleteDocument(auth.user.id, body.id, auth.supabase);
  return NextResponse.json({ ok: true });
}
