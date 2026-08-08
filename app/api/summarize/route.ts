import { NextResponse } from "next/server";
import { isAuthError, requireUser } from "@/lib/auth";
import { hasChatKey } from "@/lib/openai";
import { summarizeCorpus } from "@/lib/rag/summarize";
import { friendlyApiError, getErrorStatus } from "@/lib/retry";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth.error;

  if (!hasChatKey()) {
    return NextResponse.json(
      {
        error:
          "GROQ_API_KEY belum dikonfigurasi. Ambil gratis di https://console.groq.com/keys lalu isi .env.local.",
      },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      documentIds?: string[];
      focus?: string;
    };

    const result = await summarizeCorpus({
      userId: auth.user.id,
      supabase: auth.supabase,
      documentIds: body.documentIds,
      focus: body.focus,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: friendlyApiError(error) },
      { status: getErrorStatus(error) || 500 },
    );
  }
}
