import { NextResponse } from "next/server";
import { isAuthError, requireUser } from "@/lib/auth";
import {
  appendMessage,
  createConversation,
  touchConversationTitle,
} from "@/lib/conversations";
import { buildChatHistory, selectMessagesForGeneration } from "@/lib/chat-history";
import {
  chatModelCandidates,
  getChatClient,
  hasChatKey,
} from "@/lib/openai";
import { insertQueryLog } from "@/lib/query-logs";
import {
  buildContext,
  resolveQueryHints,
  retrieve,
} from "@/lib/rag/retrieve";
import { readStore } from "@/lib/rag/store";
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

    const storePreview = await readStore(auth.user.id, auth.supabase);
    const libraryNames = storePreview.documents.map((d) => d.filename);
    const historyTexts = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-8)
      .map((m) => m.content);
    const { retrievalQuery, hintFilenames } = resolveQueryHints(
      lastUser.content,
      historyTexts,
      libraryNames,
    );

    const { hits, citations, availableFilenames, mentionedFilenames } =
      await retrieve(retrievalQuery, {
        topK: hintFilenames.length > 0 ? 8 : 6,
        mode: "hybrid",
        userId: auth.user.id,
        supabase: auth.supabase,
        hintFilenames,
      });
    const retrieveMs = Date.now() - retrieveStarted;

    // File is in library but has zero searchable chunks — don't let the LLM contradict itself.
    const targetedFiles = [
      ...new Set([...hintFilenames, ...mentionedFilenames]),
    ].filter((f) =>
      availableFilenames.some((a) => a.toLowerCase() === f.toLowerCase()),
    );
    if (hits.length === 0 && targetedFiles.length > 0) {
      const hasChunks = storePreview.chunks.some((c) =>
        targetedFiles.some((f) => f.toLowerCase() === c.filename.toLowerCase()),
      );
      const fixed = hasChunks
        ? `File ${targetedFiles.join(", ")} ada di pustaka, tetapi cuplikan relevan gagal diambil. Coba sebut nama file lengkap, atau hapus lalu unggah ulang dokumen itu.`
        : `File ${targetedFiles.join(", ")} tercatat di pustaka, tetapi isi teksnya belum terindeks (chunk kosong). Hapus file itu di pustaka, unggah ulang, lalu tanya lagi.`;

      await appendMessage(
        auth.user.id,
        conversationId,
        { role: "assistant", content: fixed },
        auth.supabase,
      );

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const send = (payload: unknown) => {
            controller.enqueue(
              encoder.encode(`${JSON.stringify(payload)}\n`),
            );
          };
          send({ type: "meta", conversationId, retrieveMs });
          send({ type: "token", token: fixed });
          send({
            type: "done",
            conversationId,
            latency: {
              retrieveMs,
              generateMs: 0,
              totalMs: Date.now() - totalStarted,
            },
          });
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
        },
      });
    }

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

    const hasContext = hits.length > 0;
    const system = hasContext
      ? `Kamu adalah Lumen, asisten knowledge desk.
Jawab dalam bahasa yang sama dengan pertanyaan user (umumnya Bahasa Indonesia).

STATUS WAJIB: Ada ${hits.length} cuplikan relevan di bawah. Dokumen SUDAH terindeks dan tersedia.
- WAJIB menjawab/meringkas dari Konteks. Sertakan rujukan [Sumber 1], [Sumber 2], dst.
- DILARANG bilang file tidak ada, tidak tersedia, belum terindeks, atau minta user mengunggah ulang file yang sudah ada di Konteks.
- Abaikan riwayat yang pernah menolak dokumen ini secara salah.
- Jawab singkat, jelas, maksimal 2–4 paragraf. Jangan mengarang di luar Konteks.

Konteks:
${context}
${
  mentionedFilenames.length > 0
    ? `\nFile yang dimaksud user: ${mentionedFilenames.join(", ")}.`
    : ""
}`
      : `Kamu adalah Lumen, asisten knowledge desk.
Jawab dalam bahasa yang sama dengan pertanyaan user (umumnya Bahasa Indonesia).
Tidak ada cuplikan relevan di Konteks untuk pertanyaan ini. Jangan mengarang isi file.

Aturan:
- Jawab singkat. Jangan mengulang kalimat yang sama.
- Jika user menyebut file yang TIDAK ada di daftar pustaka: katakan sekali file itu belum terindeks, sebutkan file tersedia, lalu berhenti.
- Jika file ADA di daftar pustaka: JANGAN bilang file tidak ada. Katakan cuplikan relevan belum tertarik; minta nama file lengkap atau pertanyaan lebih spesifik.
- Jika pustaka kosong: sarankan unggah dokumen.

Dokumen terindeks di pustaka pengguna:
${libraryList}
${
  notInLibrary.length > 0
    ? `\nCatatan: user menyebut file yang tidak ada di pustaka: ${notInLibrary.join(", ")}.`
    : mentionedFilenames.length > 0
      ? `\nCatatan: user merujuk file terindeks: ${mentionedFilenames.join(", ")}.`
      : ""
}

Konteks: (kosong)`;

    const historySource = selectMessagesForGeneration(messages, hasContext);
    const client = getChatClient();
    const chatMessages = [
      { role: "system" as const, content: system },
      ...buildChatHistory(historySource, 8),
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
