import { NextResponse } from "next/server";
import { isAuthError, requireUser } from "@/lib/auth";
import { createConversation, listConversations } from "@/lib/conversations";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth.error;

  try {
    const conversations = await listConversations(auth.user.id, auth.supabase);
    return NextResponse.json({ conversations });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memuat percakapan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth.error;

  try {
    const body = (await request.json().catch(() => ({}))) as { title?: string };
    const conversation = await createConversation(
      auth.user.id,
      body.title || "Percakapan baru",
      auth.supabase,
    );
    return NextResponse.json({ conversation });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membuat percakapan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
