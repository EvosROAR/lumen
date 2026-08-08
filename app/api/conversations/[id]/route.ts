import { NextResponse } from "next/server";
import { isAuthError, requireUser } from "@/lib/auth";
import { deleteConversation } from "@/lib/conversations";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth.error;
  const { id } = await params;

  try {
    await deleteConversation(auth.user.id, id, auth.supabase);
    return NextResponse.json({
      ok: true,
      message:
        "Percakapan dihapus. Log metrik di halaman Metrik tetap tersimpan.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menghapus percakapan.";
    const status = message.includes("tidak ditemukan") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
