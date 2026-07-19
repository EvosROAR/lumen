"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { EvalReport } from "@/lib/eval/run";

export default function EvalPage() {
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<EvalReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/eval?k=4");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eval gagal.");
      setReport(data as EvalReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eval gagal.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    void run();
  }, [mounted, run]);

  if (!mounted) {
    return (
      <main className="min-h-screen px-6 py-10 text-sm text-ink-soft">
        Memuat evaluasi…
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-ink/10 bg-white/50 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.18em] text-ink"
            >
              LUMEN
            </Link>
            <span className="text-xs text-ink-soft">Retrieval Eval</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/desk" className="text-ink-soft hover:text-teal">
              Desk
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run()}
              className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-mist hover:bg-teal disabled:opacity-50"
            >
              {busy ? "Menjalankan…" : "Jalankan ulang"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <section>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
            Golden evaluation
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
            15 pertanyaan golden mengukur apakah retrieval mengembalikan dokumen
            yang benar (Recall@K & Precision@K). Ini artefak yang biasanya ditanya
            di interview AI Developer.
          </p>
        </section>

        {error && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
            {error}
          </p>
        )}

        {report && (
          <>
            <section className="grid gap-3 sm:grid-cols-4">
              <Metric label="Recall@4" value={`${(report.recallAtK * 100).toFixed(0)}%`} />
              <Metric
                label="Avg Precision@4"
                value={`${(report.avgPrecisionAtK * 100).toFixed(0)}%`}
              />
              <Metric label="Hits" value={`${report.hits}/${report.total}`} />
              <Metric
                label="Corpus"
                value={`${report.documentCount} docs · ${report.chunkCount} chunks`}
              />
            </section>

            <section className="overflow-hidden rounded-2xl border border-ink/10 bg-white/60">
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
    <div className="rounded-2xl border border-ink/10 bg-white/60 px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
        {label}
      </p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
        {value}
      </p>
    </div>
  );
}
