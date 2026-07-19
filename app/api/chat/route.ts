import { NextResponse } from "next/server";
import {
  chatModelCandidates,
  getChatClient,
  hasChatKey,
} from "@/lib/openai";
import { buildContext, retrieve } from "@/lib/rag/retrieve";
import {
  friendlyApiError,
  getErrorStatus,
  isRetryableStatus,
  withRetry,
} from "@/lib/retry";

export const runtime = "nodejs";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

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
    const body = (await request.json()) as { messages?: ChatMessage[] };
    const messages = body.messages ?? [];
    const lastUser = [...messages].reverse().find((m) => m.role === "user");

    if (!lastUser?.content?.trim()) {
      return NextResponse.json({ error: "Pesan user kosong." }, { status: 400 });
    }

    const { hits, citations } = await retrieve(lastUser.content, 4);
    const context = buildContext(hits);

    const system = `Kamu adalah Lumen, asisten knowledge desk.
Jawab dalam bahasa yang sama dengan pertanyaan user (umumnya Bahasa Indonesia).
Gunakan HANYA konteks sumber di bawah. Jika tidak cukup, bilang dengan jujur bahwa dokumen tidak memuat jawabannya.
Sertakan rujukan inline seperti [Sumber 1], [Sumber 2] saat memakai fakta.
Jangan mengarang kebijakan, angka, atau prosedur yang tidak ada di konteks.

${context ? `Konteks:\n${context}` : "Konteks: (kosong — belum ada dokumen relevan)"}`;

    const client = getChatClient();
    const chatMessages = [
      { role: "system" as const, content: system },
      ...messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content })),
    ];

    let completion: Awaited<
      ReturnType<typeof client.chat.completions.create>
    > | null = null;
    let lastError: unknown;

    for (const model of chatModelCandidates()) {
      try {
        completion = await withRetry(
          () =>
            client.chat.completions.create({
              model,
              stream: true,
              temperature: 0.2,
              messages: chatMessages,
            }),
          { retries: 2, baseDelayMs: 1200 },
        );
        break;
      } catch (error) {
        lastError = error;
        const status = getErrorStatus(error);
        if (!isRetryableStatus(status) && status !== 404) break;
      }
    }

    if (!completion) {
      return NextResponse.json(
        { error: friendlyApiError(lastError) },
        { status: getErrorStatus(lastError) || 503 },
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        };

        send({ type: "citations", citations });

        try {
          for await (const part of completion) {
            const token = part.choices[0]?.delta?.content;
            if (token) send({ type: "token", token });
          }
          send({ type: "done" });
        } catch (err) {
          send({ type: "error", error: friendlyApiError(err) });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: friendlyApiError(error) },
      { status: getErrorStatus(error) || 500 },
    );
  }
}
