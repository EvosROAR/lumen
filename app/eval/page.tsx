"use client";

import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Badge, Btn, Panel } from "@/components/ui";
import type { GoldenCase } from "@/lib/eval/golden";
import type { EvalReport } from "@/lib/eval/run";

type DocOption = { id: string; title: string; filename: string };

export default function EvalPage() {
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<EvalReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customCases, setCustomCases] = useState<GoldenCase[]>([]);
  const [documents, setDocuments] = useState<DocOption[]>([]);
  const [question, setQuestion] = useState("");
  const [hint, setHint] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadGolden = useCallback(async () => {
    const res = await fetch("/api/eval/golden");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Gagal memuat golden set.");
    setCustomCases(data.cases as GoldenCase[]);
    const docs = data.documents as DocOption[];
    setDocuments(docs);
    setSelectedFile((prev) => prev || docs[0]?.filename || "");
  }, []);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await loadGolden();
      const res = await fetch("/api/eval?k=4");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eval gagal.");
      setReport(data as EvalReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eval gagal.");
    } finally {
      setBusy(false);
    }
  }, [loadGolden]);

  useEffect(() => {
    if (!mounted) return;
    void run();
  }, [mounted, run]);

  async function addCase() {
    if (!question.trim() || !selectedFile) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/eval/golden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          expectedFilenames: [selectedFile],
          expectedAnswerHint: hint,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambah kasus.");
      setQuestion("");
      setHint("");
      await run();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah kasus.");
    } finally {
      setSaving(false);
    }
  }

  async function removeCase(id: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/eval/golden", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus.");
      await run();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus.");
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) {
    return (
      <main className="min-h-screen px-6 py-10 text-sm text-ink-soft">
        Memuat evaluasi…
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <AppHeader
        title="Retrieval Eval"
        trailing={
          <Btn
            className="!px-3 !py-1.5 !text-xs"
            disabled={busy}
            onClick={() => void run()}
          >
            {busy ? "Menjalankan…" : "Jalankan ulang"}
          </Btn>
        }
      />

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <section className="animate-fade-up">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
            Golden evaluation
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Ukur apakah retrieval mengembalikan dokumen yang diharapkan (Recall@K /
            Precision@K). Buat pertanyaan sesuai file di pustaka akunmu.
          </p>
        </section>

        <Panel className="animate-fade-up">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">Golden set akunmu</h2>
            <Badge>{customCases.length} kasus</Badge>
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            Hint jawaban opsional — tidak dipakai hitung skor.
          </p>

          <div className="mt-4 grid gap-2 md:grid-cols-[1fr_220px_140px_auto]">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Pertanyaan evaluasi…"
              className="rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-teal/50"
            />
            <select
              value={selectedFile}
              onChange={(e) => setSelectedFile(e.target.value)}
              className="rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-teal/50"
            >
              {documents.length === 0 && (
                <option value="">Belum ada dokumen</option>
              )}
              {documents.map((d) => (
                <option key={d.id} value={d.filename}>
                  {d.filename}
                </option>
              ))}
            </select>
            <input
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder="Hint (opsional)"
              className="rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-teal/50"
            />
            <Btn
              variant="teal"
              disabled={saving || !question.trim() || !selectedFile}
              onClick={() => void addCase()}
            >
              Tambah
            </Btn>
          </div>

          {customCases.length > 0 && (
            <ul className="mt-4 space-y-2">
              {customCases.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-ink/8 bg-mist/60 px-3 py-2 text-xs"
                >
                  <div>
                    <p className="font-medium text-ink">{c.question}</p>
                    <p className="mt-0.5 text-ink-soft">
                      Expected: {c.expectedFilenames.join(", ")}
                      {c.expectedAnswerHint
                        ? ` · hint: ${c.expectedAnswerHint}`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void removeCase(c.id)}
                    className="text-ink-soft hover:text-red-700"
                  >
                    Hapus
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {error && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
            {error}
          </p>
        )}

        {report?.message && (
          <p className="rounded-xl border border-teal/20 bg-teal/5 px-4 py-3 text-sm text-teal">
            Sumber eval: <strong>{report.source}</strong> — {report.message}
          </p>
        )}

        {report && report.source !== "none" && (
          <>
            <section className="grid animate-fade-up gap-3 sm:grid-cols-4">
              <Metric
                label={`Recall@${report.k}`}
                value={`${(report.recallAtK * 100).toFixed(0)}%`}
              />
              <Metric
                label={`Avg Precision@${report.k}`}
                value={`${(report.avgPrecisionAtK * 100).toFixed(0)}%`}
              />
              <Metric label="Hits" value={`${report.hits}/${report.total}`} />
              <Metric
                label="Corpus"
                value={`${report.documentCount} docs · ${report.chunkCount} chunks`}
              />
            </section>

            <section className="overflow-hidden rounded-2xl border border-ink/10 bg-white/60 animate-fade-up">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-ink/10 bg-mist/70 text-xs uppercase tracking-wide text-ink-soft">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Pertanyaan</th>
                    <th className="px-4 py-3 font-semibold">Expected</th>
                    <th className="px-4 py-3 font-semibold">Top retrieved</th>
                    <th className="px-4 py-3 font-semibold">P@K</th>
                  </tr>
                </thead>
                <tbody>
                  {report.cases.map((c) => (
                    <tr key={c.id} className="border-b border-ink/5 align-top">
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            c.hit
                              ? "bg-teal/15 text-teal"
                              : "bg-red-500/10 text-red-700"
                          }`}
                        >
                          {c.hit ? "HIT" : "MISS"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink">{c.question}</td>
                      <td className="px-4 py-3 text-xs text-ink-soft">
                        {c.expectedFilenames.join(", ")}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-soft">
                        {c.retrieved.length === 0 && "—"}
                        {c.retrieved.slice(0, 2).map((r) => (
                          <div key={`${c.id}-${r.filename}-${r.score}`}>
                            {r.filename} ({r.score})
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3 text-ink">{c.precisionAtK}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Panel>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
        {label}
      </p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
        {value}
      </p>
    </Panel>
  );
}
