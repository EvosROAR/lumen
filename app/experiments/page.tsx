"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Badge, Btn, Panel, ScoreBar } from "@/components/ui";
import type { Citation, RetrievalMode } from "@/lib/types";

type ModeResult = {
  mode: RetrievalMode;
  retrieveMs: number;
  citations: Citation[];
  golden: {
    matchedGoldenId: string;
    expectedFilenames: string[];
    hit: boolean;
    recallAtK: number;
    precisionAtK: number;
    k: number;
  } | null;
};

type GoldenReport = {
  mode: RetrievalMode;
  recallAtK: number;
  avgPrecisionAtK: number;
  hits: number;
  total: number;
  k: number;
};

type ExperimentResponse = {
  query: string;
  topK: number;
  totalMs: number;
  results: ModeResult[];
  goldenReports: GoldenReport[] | null;
  generatedAt: string;
};

const MODE_HELP: Record<RetrievalMode, string> = {
  vector: "Kemiripan makna (embedding)",
  bm25: "Kecocokan kata/keyword",
  hybrid: "0.55 vector + 0.45 BM25 — dipakai di chat",
};

export default function ExperimentsPage() {
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ExperimentResponse | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/suggestions");
        if (!res.ok) return;
        const json = (await res.json()) as { suggestions?: string[] };
        const next = json.suggestions ?? [];
        setSuggestions(next);
        setQuery((prev) => prev || next[0] || "");
      } catch {
        // leave empty
      }
    })();
  }, []);

  async function run(runGoldenCompare = false) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/experiments/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, topK, runGoldenCompare }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Eksperimen gagal.");
      setData(json as ExperimentResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eksperimen gagal.");
    } finally {
      setBusy(false);
    }
  }

  function exportJson() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lumen-experiment-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["mode", "rank", "filename", "title", "score", "retrieve_ms"],
    ];
    for (const result of data.results) {
      result.citations.forEach((c, i) => {
        rows.push([
          result.mode,
          String(i + 1),
          c.filename,
          c.title,
          String(c.score),
          String(result.retrieveMs),
        ]);
      });
    }
    const csv = rows
      .map((r) =>
        r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lumen-experiment-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen">
      <AppHeader title="Retrieval Experiments" />

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <section className="animate-fade-up">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
            Bandingkan 3 mode retrieval
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">
            Satu query dijalankan ke Vector, BM25, dan Hybrid. Skor #1 = 1 karena
            normalisasi per mode — bandingkan isi cuplikan & ranking, bukan angka 1-nya.
          </p>
        </section>

        <Panel className="animate-fade-up">
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 rounded-2xl border border-ink/10 bg-white/90 px-4 py-3 text-sm outline-none focus:border-teal/50"
              placeholder="Query eksperimen…"
            />
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              top-k
              <input
                type="number"
                min={1}
                max={10}
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value) || 4)}
                className="w-16 rounded-xl border border-ink/10 bg-white px-2 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.length === 0 ? (
              <p className="text-xs text-ink-soft">
                Belum ada saran dari dokumen/golden set. Ketik query sendiri.
              </p>
            ) : (
              suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setQuery(s)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    query === s
                      ? "border-teal/40 bg-teal/10 font-semibold text-teal"
                      : "border-ink/10 bg-white/80 text-ink-soft hover:border-teal/40 hover:text-teal"
                  }`}
                >
                  {s}
                </button>
              ))
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Btn
              disabled={busy || !query.trim()}
              onClick={() => void run(false)}
            >
              {busy ? "Menjalankan…" : "Jalankan 3 mode"}
            </Btn>
            <Btn
              variant="teal"
              disabled={busy || !query.trim()}
              onClick={() => void run(true)}
            >
              + Bandingkan golden set
            </Btn>
            <Btn variant="secondary" disabled={!data} onClick={exportJson}>
              Export JSON
            </Btn>
            <Btn variant="secondary" disabled={!data} onClick={exportCsv}>
              Export CSV
            </Btn>
          </div>

          {error && (
            <p
              className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-900"
              role="alert"
            >
              {error}
            </p>
          )}
        </Panel>

        {!data && !busy && (
          <Panel className="text-center">
            <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
              Belum ada hasil
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Jalankan eksperimen untuk melihat ranking tiap mode berdampingan.
            </p>
          </Panel>
        )}

        {data?.goldenReports && (
          <section className="grid animate-fade-up gap-3 md:grid-cols-3">
            {data.goldenReports.map((g) => (
              <Panel key={g.mode}>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Golden · {g.mode}
                </p>
                <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
                  R@{g.k} {(g.recallAtK * 100).toFixed(0)}%
                </p>
                <p className="text-sm text-ink-soft">
                  P@{g.k} {(g.avgPrecisionAtK * 100).toFixed(0)}% · hits{" "}
                  {g.hits}/{g.total}
                </p>
              </Panel>
            ))}
          </section>
        )}

        {data && (
          <section className="grid animate-fade-up gap-4 xl:grid-cols-3">
            {data.results.map((result) => (
              <Panel
                key={result.mode}
                className={
                  result.mode === "hybrid" ? "ring-1 ring-teal/25" : ""
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold capitalize">
                        {result.mode}
                      </h2>
                      {result.mode === "hybrid" && (
                        <Badge tone="teal">chat default</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-ink-soft">
                      {MODE_HELP[result.mode]}
                    </p>
                  </div>
                  <Badge>{result.retrieveMs} ms</Badge>
                </div>

                {result.golden && (
                  <p className="mt-2 text-xs text-teal">
                    Golden: {result.golden.hit ? "HIT" : "MISS"} · P@
                    {result.golden.k}={result.golden.precisionAtK}
                  </p>
                )}

                <ol className="mt-3 space-y-2">
                  {result.citations.length === 0 && (
                    <li className="text-xs text-ink-soft">Tidak ada hit.</li>
                  )}
                  {result.citations.map((c, i) => (
                    <li
                      key={`${result.mode}-${c.documentId}-${c.chunkIndex}-${i}`}
                      className="rounded-xl border border-ink/8 bg-mist/70 px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-ink">
                          #{i + 1}{" "}
                          <span className="font-normal text-ink-soft">
                            {c.filename}
                          </span>
                        </p>
                        <span className="shrink-0 text-[11px] font-medium text-ink-soft">
                          {c.score.toFixed(3)}
                        </span>
                      </div>
                      <ScoreBar score={c.score} />
                      <p className="mt-1.5 line-clamp-2 text-[11px] text-ink-soft">
                        {c.title}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
                        {c.excerpt}
                      </p>
                    </li>
                  ))}
                </ol>
              </Panel>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
