"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Citation, DocumentMeta } from "@/lib/types";

type ChatRole = "user" | "assistant";

type UiMessage = {
  id: string;
  role: ChatRole;
  content: string;
  citations?: Citation[];
};

type DocsResponse = {
  configured: boolean;
  demoMode?: boolean;
  storage?: "supabase" | "file";
  documents: DocumentMeta[];
  chunkCount: number;
};

export default function DeskPage() {
  const [mounted, setMounted] = useState(false);
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [chunkCount, setChunkCount] = useState(0);
  const [configured, setConfigured] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [storage, setStorage] = useState<"supabase" | "file">("file");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteBody, setPasteBody] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const refreshDocs = useCallback(async () => {
    const res = await fetch("/api/documents");
    const data = (await res.json()) as DocsResponse;
    setDocs(data.documents);
    setChunkCount(data.chunkCount);
    setConfigured(data.configured);
    setDemoMode(Boolean(data.demoMode));
    setStorage(data.storage === "supabase" ? "supabase" : "file");
  }, []);

  useEffect(() => {
    if (!mounted) return;
    void refreshDocs();
  }, [mounted, refreshDocs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const suggestions = useMemo(
    () => [
      "Berapa hari cuti tahunan karyawan?",
      "Berapa SLA first response P1 support?",
      "Apa aturan hybrid remote work?",
      "Bagaimana cara klaim expense?",
    ],
    [],
  );

  async function summarizeAll(focus?: string) {
    if (docs.length === 0 || busy) return;

    const userText = focus?.trim()
      ? `Rangkum semua materi (fokus: ${focus.trim()})`
      : "Rangkum semua materi dari awal sampai akhir";

    const userMsg: UiMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: userText,
    };
    const assistantId = `a_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setBusy(true);
    setStatus("Merangkum semua dokumen (map-reduce)… ini bisa 30–90 detik.");

    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focus: focus?.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rangkuman gagal.");

      const mapList = (data.mapSummaries as { title: string; summary: string }[])
        .map((m, i) => `${i + 1}. ${m.title}`)
        .join("\n");

      const content = `${data.summary}

———
Sumber dirangkum: ${data.documentCount} dokumen · ${data.chunkCount} chunk
${mapList}`;

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content } : m)),
      );
      setStatus(
        `Rangkuman selesai dari ${data.documentCount} dokumen (${data.chunkCount} chunk).`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Rangkuman gagal.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: `⚠️ ${message}` } : m,
        ),
      );
      setStatus(message);
    } finally {
      setBusy(false);
    }
  }

  async function loadSamples() {
    setBusy(true);
    setStatus("Mengindeks dokumen contoh…");
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "samples" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat sampel.");
      setStatus(`Siap — ${data.documents.length} dokumen contoh terindeks.`);
      await refreshDocs();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Gagal memuat sampel.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File) {
    setBusy(true);
    setStatus(`Mengindeks ${file.name}…`);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/ingest", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload gagal.");
      setStatus(`Terindeks: ${data.document.title} (${data.document.chunks} chunk).`);
      await refreshDocs();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Upload gagal.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submitPaste() {
    if (!pasteBody.trim()) return;
    setBusy(true);
    setStatus("Mengindeks teks…");
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pasteTitle || "Catatan tempel",
          filename: "paste.txt",
          content: pasteBody,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ingest gagal.");
      setPasteOpen(false);
      setPasteTitle("");
      setPasteBody("");
      setStatus(`Terindeks: ${data.document.title}.`);
      await refreshDocs();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Ingest gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function removeDoc(id: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Hapus gagal.");
      }
      await refreshDocs();
      setStatus("Dokumen dihapus dari knowledge store.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Hapus gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(text: string) {
    const content = text.trim();
    if (!content || busy) return;

    const userMsg: UiMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content,
    };
    const assistantId = `a_${Date.now()}`;
    const nextMessages = [...messages, userMsg];
    setMessages([
      ...nextMessages,
      { id: assistantId, role: "assistant", content: "", citations: [] },
    ]);
    setInput("");
    setBusy(true);
    setStatus(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Chat gagal.");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Stream tidak tersedia.");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as
            | { type: "citations"; citations: Citation[] }
            | { type: "token"; token: string }
            | { type: "done" }
            | { type: "error"; error: string };

          if (event.type === "citations") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, citations: event.citations } : m,
              ),
            );
          } else if (event.type === "token") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + event.token }
                  : m,
              ),
            );
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chat gagal.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: m.content || `⚠️ ${message}` }
            : m,
        ),
      );
      setStatus(message);
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto max-w-7xl px-6 py-10 text-sm text-ink-soft">
          Memuat desk…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink/10 bg-white/50 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.18em] text-ink"
            >
              LUMEN
            </Link>
            <span className="hidden text-xs text-ink-soft sm:inline">
              Knowledge Desk
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Link href="/eval" className="text-ink-soft transition hover:text-teal">
              Eval
            </Link>
            {demoMode && (
              <span className="rounded-full bg-ink/5 px-2.5 py-1 font-medium text-ink-soft">
                Demo read-only
              </span>
            )}
            {!demoMode && storage === "supabase" && (
              <span className="rounded-full bg-teal/15 px-2.5 py-1 font-medium text-teal">
                Supabase
              </span>
            )}
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${
                configured
                  ? "bg-teal/15 text-teal"
                  : "bg-amber-500/15 text-amber-800"
              }`}
            >
              {configured ? "Groq siap" : "Perlu GROQ_API_KEY"}
            </span>
            <span className="rounded-full bg-ink/5 px-2.5 py-1 text-ink-soft">
              {docs.length} docs · {chunkCount} chunks
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[320px_1fr] sm:px-6">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-ink/10 bg-white/55 p-4 backdrop-blur">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
              Pustaka
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              {demoMode
                ? "Demo live: materi seed siap dipakai. Upload dinonaktifkan di deployment."
                : "Unggah .txt / .md / .pdf, tempel teks, atau muat contoh."}
            </p>

            <div className="mt-4 flex flex-col gap-2">
              {!demoMode && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void loadSamples()}
                    className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-mist transition hover:bg-teal disabled:opacity-50"
                  >
                    Muat contoh
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                    className="rounded-full border border-ink/15 bg-white/70 px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-teal/40 hover:text-teal disabled:opacity-50"
                  >
                    Unggah file
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setPasteOpen((v) => !v)}
                    className="rounded-full border border-ink/15 bg-white/70 px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-teal/40 hover:text-teal disabled:opacity-50"
                  >
                    Tempel teks
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={busy || docs.length === 0}
                onClick={() => void summarizeAll()}
                className="rounded-full border border-teal/30 bg-teal/10 px-4 py-2 text-sm font-semibold text-teal transition hover:bg-teal hover:text-white disabled:opacity-40"
              >
                Rangkum semua
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadFile(file);
                }}
              />
            </div>

            {pasteOpen && (
              <div className="mt-4 space-y-2 border-t border-ink/10 pt-4">
                <input
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  placeholder="Judul"
                  className="w-full rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-teal/50"
                />
                <textarea
                  value={pasteBody}
                  onChange={(e) => setPasteBody(e.target.value)}
                  placeholder="Tempel kebijakan, runbook, catatan…"
                  rows={6}
                  className="w-full resize-y rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-teal/50"
                />
                <button
                  type="button"
                  disabled={busy || !pasteBody.trim()}
                  onClick={() => void submitPaste()}
                  className="w-full rounded-full bg-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Indeks teks
                </button>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-ink/10 bg-white/55 p-4 backdrop-blur">
            <h3 className="text-sm font-semibold text-ink">Dokumen terindeks</h3>
            <ul className="mt-3 max-h-[42vh] space-y-2 overflow-y-auto pr-1">
              {docs.length === 0 && (
                <li className="text-xs text-ink-soft">
                  Belum ada dokumen. Mulai dengan contoh atau upload.
                </li>
              )}
              {docs.map((doc) => (
                <li
                  key={doc.id}
                  className="rounded-xl border border-ink/8 bg-mist/60 px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-ink">{doc.title}</p>
                      <p className="mt-0.5 text-[11px] text-ink-soft">
                        {doc.chunks} chunk · {doc.chars} karakter
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy || demoMode}
                      onClick={() => void removeDoc(doc.id)}
                      className="text-[11px] font-medium text-ink-soft hover:text-red-700 disabled:opacity-30"
                    >
                      Hapus
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <section className="flex min-h-[70vh] flex-col rounded-2xl border border-ink/10 bg-white/60 backdrop-blur">
          <div className="border-b border-ink/10 px-4 py-3 sm:px-5">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
              Percakapan
            </h2>
            <p className="text-xs text-ink-soft">
              Tanya spesifik (RAG) atau pakai <span className="font-semibold">Rangkum semua</span> untuk ringkasan map-reduce.
            </p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            {messages.length === 0 && (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center">
                <p className="font-[family-name:var(--font-display)] text-2xl font-medium text-ink">
                  Siap menjawab dari pustakamu
                </p>
                <p className="mt-2 max-w-md text-sm text-ink-soft">
                  Muat dokumen contoh, lalu coba salah satu pertanyaan di bawah.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    disabled={busy || docs.length === 0}
                    onClick={() => void summarizeAll()}
                    className="rounded-full bg-teal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    Rangkum semua materi
                  </button>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busy || docs.length === 0}
                      onClick={() => void sendMessage(s)}
                      className="rounded-full border border-ink/10 bg-white/80 px-3 py-1.5 text-left text-xs text-ink-soft transition hover:border-teal/40 hover:text-teal disabled:opacity-40"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <article
                key={m.id}
                className={`max-w-3xl ${m.role === "user" ? "ml-auto" : ""}`}
              >
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                  {m.role === "user" ? "Kamu" : "Lumen"}
                </p>
                <div
                  className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-ink text-mist"
                      : "border border-ink/10 bg-mist/80 text-ink"
                  }`}
                >
                  {m.content || (busy ? "…" : "")}
                </div>
                {m.role === "assistant" && m.citations && m.citations.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                      Sumber terambil
                    </p>
                    {m.citations.map((c, i) => (
                      <div
                        key={`${c.documentId}-${c.chunkIndex}-${i}`}
                        className="rounded-xl border border-teal/20 bg-teal/5 px-3 py-2"
                      >
                        <p className="text-xs font-semibold text-teal">
                          [{i + 1}] {c.title} · skor {c.score}
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
                          {c.excerpt}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-ink/10 p-4 sm:p-5">
            {status && (
              <p className="mb-3 text-xs text-ink-soft" role="status">
                {status}
              </p>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage(input);
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy}
                placeholder={
                  docs.length === 0
                    ? "Indeks dokumen dulu sebelum bertanya…"
                    : "Tanyakan sesuatu dari dokumen…"
                }
                className="flex-1 rounded-full border border-ink/10 bg-white/90 px-4 py-3 text-sm outline-none focus:border-teal/50 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={busy || !input.trim() || docs.length === 0}
                className="rounded-full bg-teal px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink disabled:opacity-40"
              >
                Kirim
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
