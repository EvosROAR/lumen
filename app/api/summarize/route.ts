import { NextResponse } from "next/server";
import { hasChatKey } from "@/lib/openai";
import { summarizeCorpus } from "@/lib/rag/summarize";
import { friendlyApiError, getErrorStatus } from "@/lib/retry";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
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
