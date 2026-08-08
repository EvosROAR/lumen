import { NextResponse } from "next/server";
import { isAuthError, requireUser } from "@/lib/auth";
import {
  appendMessage,
  createConversation,
  touchConversationTitle,
} from "@/lib/conversations";
import { buildChatHistory } from "@/lib/chat-history";
import {
  chatModelCandidates,
  getChatClient,
  hasChatKey,
} from "@/lib/openai";
import { insertQueryLog } from "@/lib/query-logs";
import { buildContext, retrieve } from "@/lib/rag/retrieve";
import {
  friendlyApiError,
  getErrorStatus,
  isRetryableStatus,
  withRetry,
} from "@/lib/retry";
import type { Citation } from "@/lib/types";

export const runtime = "nodejs";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

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
    const body = (await request.json()) as {
      messages?: ChatMessage[];
      conversationId?: string;
    };
    const messages = body.messages ?? [];
    const lastUser = [...messages].reverse().find((m) => m.role === "user");

    if (!lastUser?.content?.trim()) {
      return NextResponse.json({ error: "Pesan user kosong." }, { status: 400 });
    }

    let conversationId = body.conversationId;
    if (!conversationId) {
      const conv = await createConversation(
        auth.user.id,
        lastUser.content.slice(0, 60),
        auth.supabase,
      );
      conversationId = conv.id;
    } else {
      await touchConversationTitle(
        auth.user.id,
        conversationId,
        lastUser.content.slice(0, 60),
        auth.supabase,
      );
    }

    await appendMessage(
      auth.user.id,
      conversationId,
      { role: "user", content: lastUser.content },
      auth.supabase,
    );

    const totalStarted = Date.now();
    const retrieveStarted = Date.now();
    const { hits, citations, availableFilenames, mentionedFilenames } =
      await retrieve(lastUser.content, {
        topK: 4,
        mode: "hybrid",
        userId: auth.user.id,
        supabase: auth.supabase,
      });
    const retrieveMs = Date.now() - retrieveStarted;
    const context = buildContext(hits);

    const libraryList =
      availableFilenames.length > 0
        ? availableFilenames.map((f) => `- ${f}`).join("\n")
        : "(pustaka kosong)";

    const rawFileMentions =
      lastUser.content.match(/[\w.\- ()]+\.(txt|md|pdf)/gi) ?? [];
    const notInLibrary = [
      ...new Set(
        rawFileMentions.filter(
          (m) =>
            !availableFilenames.some(
              (a) => a.toLowerCase() === m.toLowerCase(),
            ),
        ),
      ),
    ];

    const system = `Kamu adalah Lumen, asisten knowledge desk.
Jawab dalam bahasa yang sama dengan pertanyaan user (umumnya Bahasa Indonesia).
Gunakan HANYA konteks sumber di bawah. Jangan mengarang isi file yang tidak ada di konteks.

Aturan jawaban:
- Jawab singkat, jelas, maksimal 2–4 paragraf. JANGAN mengulang kalimat yang sama.
- Jika konteks cukup: jawab langsung + rujukan [Sumber 1], [Sumber 2].
- Jika user menanyakan file tertentu yang TIDAK ada di pustaka atau tidak ada di konteks: katakan sekali saja bahwa file itu tidak tersedia di pustaka terindeks, sebutkan file yang tersedia, lalu berhenti. Jangan mengulang permintaan maaf.
- Jika konteks kosong/tidak relevan: akui keterbatasan sekali, sarankan unggah/indeks dokumen yang dimaksud, lalu berhenti.

Dokumen terindeks di pustaka pengguna:
${libraryList}
${
  notInLibrary.length > 0
    ? `\nCatatan: user menyebut file yang tidak ada di pustaka: ${notInLibrary.join(", ")}.`
    : mentionedFilenames.length > 0
      ? `\nCatatan: user merujuk file terindeks: ${mentionedFilenames.join(", ")}.`
      : ""
}

${context ? `Konteks:\n${context}` : "Konteks: (kosong — belum ada dokumen relevan untuk pertanyaan ini)"}`;

    const client = getChatClient();
    const chatMessages = [
      { role: "system" as const, content: system },
      ...buildChatHistory(messages, 8),
    ];

    let completion: Awaited<
      ReturnType<typeof client.chat.completions.create>
    > | null = null;
    let lastError: unknown;

    const generateStarted = Date.now();
    for (const model of chatModelCandidates()) {
      try {
        completion = await withRetry(
          () =>
            client.chat.completions.create({
              model,
              stream: true,
              temperature: 0.2,
              max_tokens: 700,
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
    const userId = auth.user.id;
    const supabase = auth.supabase;
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        };

        send({ type: "meta", conversationId, retrieveMs });
        send({ type: "citations", citations });

        let assistantText = "";
        try {
          for await (const part of completion) {
            const token = part.choices[0]?.delta?.content;
            if (token) {
              assistantText += token;
              send({ type: "token", token });
            }
          }

          const generateMs = Date.now() - generateStarted;
          const totalMs = Date.now() - totalStarted;

          await appendMessage(
            userId,
            conversationId!,
            {
              role: "assistant",
              content: assistantText,
              citations: citations as Citation[],
            },
            supabase,
          );

          await insertQueryLog(
            userId,
            {
              conversationId,
              query: lastUser.content,
              retrievalMode: "hybrid",
              retrieveMs,
              generateMs,
              totalMs,
              topK: 4,
              citationCount: citations.length,
              citationFilenames: citations.map((c) => c.filename),
            },
            supabase,
          );

          send({
            type: "done",
            conversationId,
            latency: { retrieveMs, generateMs, totalMs },
          });
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
