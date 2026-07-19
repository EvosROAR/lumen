import {
  chatModel,
  chatModelCandidates,
  getChatClient,
} from "@/lib/openai";
import {
  friendlyApiError,
  getErrorStatus,
  isRetryableStatus,
  withRetry,
} from "@/lib/retry";
import { readStore } from "@/lib/rag/store";
import type { ChunkRecord, DocumentMeta } from "@/lib/types";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function completeOnce(prompt: string): Promise<string> {
  const client = getChatClient();
  let lastError: unknown;

  for (const model of chatModelCandidates()) {
    try {
      const completion = await withRetry(
        () =>
          client.chat.completions.create({
            model: model || chatModel(),
            temperature: 0.2,
            messages: [
              {
                role: "system",
                content:
                  "Kamu asisten perangkum materi. Bahasa Indonesia, padat, akurat, tanpa mengarang.",
              },
              { role: "user", content: prompt },
            ],
          }),
        { retries: 2, baseDelayMs: 1500 },
      );

      const text = completion.choices[0]?.message?.content?.trim();
      if (text) return text;
      throw new Error("Model mengembalikan jawaban kosong.");
    } catch (error) {
      lastError = error;
      const status = getErrorStatus(error);
      if (!isRetryableStatus(status) && status !== 404) break;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(friendlyApiError(lastError));
}

function groupChunksByDoc(
  docs: DocumentMeta[],
  chunks: ChunkRecord[],
  documentIds?: string[],
) {
  const selectedDocs = documentIds?.length
    ? docs.filter((d) => documentIds.includes(d.id))
    : docs;

  return selectedDocs.map((doc) => ({
    doc,
    chunks: chunks
      .filter((c) => c.documentId === doc.id)
      .sort((a, b) => a.index - b.index),
  }));
}

export type SummarizeProgress = {
  phase: "map" | "reduce" | "done";
  current: number;
  total: number;
  label: string;
};

export type SummarizeResult = {
  summary: string;
  documentCount: number;
  chunkCount: number;
  mapSummaries: { title: string; summary: string }[];
};

/**
 * Map-reduce summarization over the whole corpus (or selected docs).
 * Map: summarize each document from all its chunks.
 * Reduce: merge document summaries into one final overview.
 */
export async function summarizeCorpus(opts: {
  documentIds?: string[];
  focus?: string;
  onProgress?: (p: SummarizeProgress) => void;
}): Promise<SummarizeResult> {
  const store = await readStore();
  const groups = groupChunksByDoc(
    store.documents,
    store.chunks,
    opts.documentIds,
  ).filter((g) => g.chunks.length > 0);

  if (groups.length === 0) {
    throw new Error("Tidak ada dokumen untuk dirangkum. Indeks materi dulu.");
  }

  const focus = opts.focus?.trim();
  const mapSummaries: { title: string; summary: string }[] = [];
  const total = groups.length + 1;

  for (let i = 0; i < groups.length; i++) {
    const { doc, chunks } = groups[i];
    opts.onProgress?.({
      phase: "map",
      current: i + 1,
      total,
      label: `Merangkum: ${doc.title}`,
    });

    const joined = chunks
      .map((c, idx) => `[Bagian ${idx + 1}]\n${c.text}`)
      .join("\n\n");

    // Keep prompt bounded for free-tier models
    const body = joined.length > 12000 ? `${joined.slice(0, 12000)}\n…` : joined;

    const prompt = `Ringkas dokumen berikut secara lengkap tapi padat (maks ~180 kata).
Sertakan poin penting, angka, istilah kunci, dan aturan bila ada.
${focus ? `Fokus tambahan: ${focus}` : ""}

Judul: ${doc.title}
Filename: ${doc.filename}

Isi:
${body}`;

    const summary = await completeOnce(prompt);
    mapSummaries.push({ title: doc.title, summary });

    // Soft throttle for Groq free tier
    if (i < groups.length - 1) await sleep(700);
  }

  opts.onProgress?.({
    phase: "reduce",
    current: total,
    total,
    label: "Menggabungkan semua ringkasan…",
  });

  const mergedInput = mapSummaries
    .map((m, i) => `[Dokumen ${i + 1}] ${m.title}\n${m.summary}`)
    .join("\n\n---\n\n");

  const finalPrompt = `Gabungkan ringkasan dokumen di bawah menjadi SATU rangkuman menyeluruh materi dari awal sampai akhir.

Aturan:
- Bahasa Indonesia
- Struktur: ringkasan eksekutif (3–5 kalimat), lalu poin-poin utama per tema/dokumen
- Jangan mengarang fakta di luar sumber
- Maksimal ~400 kata
${focus ? `- Fokus: ${focus}` : ""}

Sumber ringkasan:
${mergedInput}`;

  const summary = await completeOnce(finalPrompt);

  opts.onProgress?.({
    phase: "done",
    current: total,
    total,
    label: "Selesai",
  });

  return {
    summary,
    documentCount: groups.length,
    chunkCount: groups.reduce((s, g) => s + g.chunks.length, 0),
    mapSummaries,
  };
}
