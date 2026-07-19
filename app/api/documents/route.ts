import { NextResponse } from "next/server";
import { deleteDocument } from "@/lib/rag/ingest";
import { hasChatKey } from "@/lib/openai";
import { isDemoMode, readStore } from "@/lib/rag/store";

export const runtime = "nodejs";

export async function GET() {
  const store = await readStore();
  return NextResponse.json({
    configured: hasChatKey(),
    demoMode: isDemoMode(),
    documents: store.documents,
    chunkCount: store.chunks.length,
  });
}

export async function DELETE(request: Request) {
  if (isDemoMode()) {
    return NextResponse.json(
      {
        error:
          "Mode demo read-only: hapus dokumen dinonaktifkan. Materi seed dipakai untuk demo live.",
      },
      { status: 403 },
    );
  }

  const body = (await request.json()) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "id wajib." }, { status: 400 });
  }
  await deleteDocument(body.id);
  return NextResponse.json({ ok: true });
}
