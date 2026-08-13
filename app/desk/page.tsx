"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Badge, Btn, Panel, ScoreBar } from "@/components/ui";
import { readJsonResponse } from "@/lib/http";
import { isFalseLibraryRefusal } from "@/lib/chat-history";
import type { Citation, ConversationMeta, DocumentMeta } from "@/lib/types";

type MobilePane = "chat" | "library" | "history";

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
  user?: { id: string; email?: string | null };
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
  const [email, setEmail] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteBody, setPasteBody] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [mobilePane, setMobilePane] = useState<MobilePane>("chat");
  const [pendingDelete, setPendingDelete] = useState<{
    kind: "document" | "conversation";
    id: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const refreshDocs = useCallback(async () => {
    const res = await fetch("/api/documents");
    if (res.status === 401) {
      window.location.href = "/login?next=/desk";
      return;
    }
    const data = (await res.json()) as DocsResponse;
    setDocs(data.documents);
    setChunkCount(data.chunkCount);
    setConfigured(data.configured);
    setDemoMode(Boolean(data.demoMode));
    setStorage(data.storage === "supabase" ? "supabase" : "file");
    setEmail(data.user?.email ?? null);
  }, []);

  const refreshConversations = useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (!res.ok) return;
    const data = (await res.json()) as { conversations: ConversationMeta[] };
    setConversations(data.conversations);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    void refreshDocs();
    void refreshConversations();
  }, [mounted, refreshDocs, refreshConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!mounted) return;
    void (async () => {
      try {
        const res = await fetch("/api/suggestions");
        if (!res.ok) return;
        const json = (await res.json()) as { suggestions?: string[] };
        setSuggestions(json.suggestions ?? []);
      } catch {
        setSuggestions([]);
      }
    })();
  }, [mounted, docs.length]);

  async function startNewChat() {
    setConversationId(null);
    setMessages([]);
    setStatus(null);
  }

  async function loadConversation(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/conversations/${id}/messages`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat percakapan.");
      setConversationId(id);
      setMessages(
        (data.messages as {
          id: string;
          role: ChatRole;
          content: string;
          citations?: Citation[] | null;
        }[])
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            citations: m.citations ?? undefined,
          })),
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Gagal memuat percakapan.");
    } finally {
      setBusy(false);
    }
  }

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
      const data = await readJsonResponse<{
        error?: string;
        documents?: DocumentMeta[];
      }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal memuat sampel.");
      setStatus(`Siap — ${(data.documents ?? []).length} dokumen contoh terindeks.`);
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
      if (file.size > 4 * 1024 * 1024) {
        throw new Error(
          `File terlalu besar (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maksimal sekitar 4 MB.`,
        );
      }
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/ingest", { method: "POST", body: form });
      const data = await readJsonResponse<{
        error?: string;
        document?: DocumentMeta;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Upload gagal.");
      setStatus(
        `Terindeks: ${data.document?.title} (${data.document?.chunks} chunk).`,
      );
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
      const data = await readJsonResponse<{
        error?: string;
        document?: DocumentMeta;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Ingest gagal.");
      setPasteOpen(false);
      setPasteTitle("");
      setPasteBody("");
      setStatus(`Terindeks: ${data.document?.title}.`);
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
      setPendingDelete(null);
      setStatus("Dokumen dihapus dari knowledge store.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Hapus gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function removeConversation(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      const data = await readJsonResponse<{ error?: string; message?: string }>(
        res,
      );
      if (!res.ok) throw new Error(data.error || "Hapus percakapan gagal.");
      if (conversationId === id) {
        setConversationId(null);
        setMessages([]);
      }
      setPendingDelete(null);
      await refreshConversations();
      setStatus(
        data.message ||
          "Percakapan dihapus. Log metrik di halaman Metrik tetap ada.",
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Hapus percakapan gagal.");
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
      // Broken rooms: old false refusals poison the model. Send user turns only
      // (like a new chat) while keeping the same conversationId for history UI.
      const threadPoisoned = messages.some(
        (m) => m.role === "assistant" && isFalseLibraryRefusal(m.content),
      );
      const payloadMessages = threadPoisoned
        ? [...messages.filter((m) => m.role === "user"), userMsg]
            .slice(-4)
            .map((m) => ({ role: m.role, content: m.content }))
        : nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          }));

      if (threadPoisoned) {
        setStatus(
          "Riwayat tolakan di chat ini diabaikan supaya jawaban bisa akurat.",
        );
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationId || undefined,
          messages: payloadMessages,
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
            | { type: "meta"; conversationId: string; retrieveMs: number }
            | { type: "citations"; citations: Citation[] }
            | { type: "token"; token: string }
            | {
                type: "done";
                conversationId?: string;
                latency?: { retrieveMs: number; generateMs: number; totalMs: number };
              }
            | { type: "error"; error: string };

          if (event.type === "meta") {
            setConversationId(event.conversationId);
          } else if (event.type === "citations") {
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
          } else if (event.type === "done") {
            if (event.latency) {
              setStatus(
                `Latency: retrieve ${event.latency.retrieveMs}ms · generate ${event.latency.generateMs}ms · total ${event.latency.totalMs}ms`,
              );
            }
            void refreshConversations();
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

  const renderHistoryPanel = () => (
    <Panel className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Riwayat
        </h2>
        <Btn
          variant="ghost"
          className="!px-2 !py-1 text-xs"
          disabled={busy}
          onClick={() => {
            void startNewChat();
            setMobilePane("chat");
          }}
        >
          Chat baru
        </Btn>
      </div>
      <ul className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
        {conversations.length === 0 && (
          <li className="rounded-xl bg-mist/70 px-3 py-3 text-xs text-ink-soft">
            Belum ada percakapan. Kirim pertanyaan pertama di panel chat.
          </li>
        )}
        {conversations.map((c) => (
          <li
            key={c.id}
            className={`flex items-stretch gap-1 rounded-xl transition ${
              conversationId === c.id ? "bg-teal/15" : "hover:bg-ink/5"
            }`}
          >
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void loadConversation(c.id);
                setMobilePane("chat");
              }}
              className={`min-w-0 flex-1 px-3 py-2.5 text-left text-xs ${
                conversationId === c.id
                  ? "font-semibold text-teal"
                  : "text-ink-soft"
              }`}
            >
              <span className="line-clamp-2">{c.title}</span>
            </button>
            <button
              type="button"
              disabled={busy}
              title="Hapus percakapan"
              aria-label={`Hapus percakapan ${c.title}`}
              onClick={(e) => {
                e.stopPropagation();
                setPendingDelete({
                  kind: "conversation",
                  id: c.id,
                  title: c.title,
                });
              }}
              className="shrink-0 px-2.5 text-[11px] font-medium text-ink-soft hover:text-red-700 disabled:opacity-30"
            >
              Hapus
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );

  const renderLibraryPanel = () => (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <Panel className="shrink-0">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Pustaka
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          Dokumen milik akunmu. Unggah .txt / .md / .pdf atau muat contoh.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {!demoMode && (
            <>
              <Btn disabled={busy} onClick={() => void loadSamples()}>
                Muat contoh
              </Btn>
              <Btn
                variant="secondary"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                Unggah file
              </Btn>
              <Btn
                variant="secondary"
                disabled={busy}
                onClick={() => setPasteOpen((v) => !v)}
              >
                Tempel teks
              </Btn>
            </>
          )}
          <Btn
            variant="teal"
            disabled={busy || docs.length === 0}
            onClick={() => {
              void summarizeAll();
              setMobilePane("chat");
            }}
          >
            Rangkum semua
          </Btn>
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
              rows={4}
              className="w-full resize-y rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-sm outline-none focus:border-teal/50"
            />
            <Btn
              variant="teal"
              className="w-full"
              disabled={busy || !pasteBody.trim()}
              onClick={() => void submitPaste()}
            >
              Indeks teks
            </Btn>
          </div>
        )}
      </Panel>

      <Panel className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Dokumen terindeks</h3>
          <Badge>{docs.length}</Badge>
        </div>
        <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
          {docs.length === 0 && (
            <li className="rounded-xl bg-mist/70 px-3 py-3 text-xs text-ink-soft">
              Belum ada dokumen. Mulai dengan unggah atau muat contoh.
            </li>
          )}
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="rounded-xl border border-ink/8 bg-mist/60 px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {doc.title}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-soft">
                    {doc.chunks} chunk · {doc.chars.toLocaleString("id-ID")} karakter
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy || demoMode}
                  onClick={() =>
                    setPendingDelete({
                      kind: "document",
                      id: doc.id,
                      title: doc.title,
                    })
                  }
                  className="shrink-0 text-[11px] font-medium text-ink-soft hover:text-red-700 disabled:opacity-30"
                >
                  Hapus
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );

  const renderChatPanel = () => (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-ink/10 bg-white/65 backdrop-blur">
      <div className="shrink-0 border-b border-ink/10 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
              Percakapan
            </h2>
            <p className="text-xs text-ink-soft">
              Retrieval hybrid + jawaban ber-sitasi. Mode eksperimen ada di menu
              Eksperimen.
            </p>
          </div>
          <Badge tone="muted">Hybrid</Badge>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
        {messages.length === 0 && (
          <div className="animate-fade-up flex h-full min-h-[200px] flex-col items-center justify-center text-center">
            <p className="font-[family-name:var(--font-display)] text-2xl font-medium text-ink">
              Siap menjawab dari pustakamu
            </p>
            <p className="mt-2 max-w-md text-sm text-ink-soft">
              {docs.length === 0
                ? "Indeks dokumen dulu di tab Pustaka, lalu mulai bertanya."
                : "Coba salah satu saran di bawah, atau ketik pertanyaan sendiri."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {docs.length > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void summarizeAll()}
                  className="rounded-full bg-teal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  Rangkum semua materi
                </button>
              )}
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
            className={`animate-fade-up max-w-3xl ${m.role === "user" ? "ml-auto" : ""}`}
          >
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
              {m.role === "user" ? "Kamu" : "Lumen"}
            </p>
            <div
              className={`prose-chat whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
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
                  Sumber terambil · hybrid
                </p>
                {m.citations.map((c, i) => (
                  <div
                    key={`${c.documentId}-${c.chunkIndex}-${i}`}
                    className="rounded-xl border border-teal/20 bg-teal/5 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-teal">
                        [{i + 1}] {c.title}
                      </p>
                      <span className="shrink-0 text-[11px] font-medium text-ink-soft">
                        {c.score.toFixed(3)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-ink-soft">{c.filename}</p>
                    <ScoreBar score={c.score} />
                    <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
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

      <div className="shrink-0 border-t border-ink/10 p-4 sm:p-5">
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
  );

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden">
      <div className="shrink-0">
        <AppHeader
          title="Knowledge Desk"
          email={email}
          trailing={
            <>
              {!demoMode && storage === "supabase" && (
                <Badge tone="teal">Supabase</Badge>
              )}
              <Badge tone={configured ? "teal" : "warn"}>
                {configured ? "Groq siap" : "Perlu GROQ_API_KEY"}
              </Badge>
              <Badge>
                {docs.length} docs · {chunkCount} chunks
              </Badge>
            </>
          }
        />
      </div>

      {/* Mobile panes */}
      <div className="shrink-0 border-b border-ink/10 bg-white/40 px-4 py-2 lg:hidden">
        <div className="mx-auto flex max-w-7xl gap-1">
          {(
            [
              ["chat", "Chat"],
              ["library", "Pustaka"],
              ["history", "Riwayat"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMobilePane(id)}
              className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ${
                mobilePane === id
                  ? "bg-ink text-mist"
                  : "text-ink-soft hover:bg-ink/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 grid-cols-1 gap-4 overflow-hidden px-4 py-4 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)_260px] lg:gap-5 lg:py-4">
        <aside className="hidden min-h-0 lg:block">{renderHistoryPanel()}</aside>

        <div className="hidden min-h-0 lg:block">{renderChatPanel()}</div>

        <aside className="hidden min-h-0 lg:block">{renderLibraryPanel()}</aside>

        <div className="h-full min-h-0 lg:hidden">
          {mobilePane === "chat" && renderChatPanel()}
          {mobilePane === "library" && renderLibraryPanel()}
          {mobilePane === "history" && renderHistoryPanel()}
        </div>
      </div>

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title={
          pendingDelete?.kind === "conversation"
            ? "Hapus percakapan?"
            : "Hapus dokumen terindeks?"
        }
        description={
          pendingDelete?.kind === "conversation"
            ? `"${pendingDelete.title}" akan dihapus dari daftar chat. Log latency/query di halaman Metrik tetap tersimpan.`
            : pendingDelete
              ? `"${pendingDelete.title}" akan dihapus dari pustaka akunmu beserta semua chunk-nya. Tindakan ini tidak bisa dibatalkan.`
              : ""
        }
        confirmLabel="Ya, hapus"
        cancelLabel="Batal"
        tone="danger"
        busy={busy}
        onCancel={() => {
          if (!busy) setPendingDelete(null);
        }}
        onConfirm={() => {
          if (!pendingDelete) return;
          if (pendingDelete.kind === "conversation") {
            void removeConversation(pendingDelete.id);
          } else {
            void removeDoc(pendingDelete.id);
          }
        }}
      />
    </main>
  );
}
