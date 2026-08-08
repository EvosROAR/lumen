import { NextResponse } from "next/server";
import { isAuthError, requireUser } from "@/lib/auth";
import {
  appendMessage,
  getConversationMessages,
} from "@/lib/conversations";
import type { Citation } from "@/lib/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth.error;
  const { id } = await params;

  try {
    const messages = await getConversationMessages(
      auth.user.id,
      id,
      auth.supabase,
    );
    return NextResponse.json({ messages });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memuat pesan.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth.error;
  const { id } = await params;

  try {
    const body = (await request.json()) as {
      role?: "user" | "assistant" | "system";
      content?: string;
      citations?: Citation[];
    };
    if (!body.role || !body.content?.trim()) {
      return NextResponse.json(
        { error: "role dan content wajib." },
        { status: 400 },
      );
    }
    const message = await appendMessage(
      auth.user.id,
      id,
      {
        role: body.role,
        content: body.content,
        citations: body.citations,
      },
      auth.supabase,
    );
    return NextResponse.json({ message });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menyimpan pesan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
