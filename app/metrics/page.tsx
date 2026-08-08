"use client";

import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Btn, Panel } from "@/components/ui";
import type { QueryLog } from "@/lib/types";

type MetricsResponse = {
  logs: QueryLog[];
  summary: {
    count: number;
    avgTotalMs: number;
    avgRetrieveMs: number;
    avgCitationCount: number;
  };
};

export default function MetricsPage() {
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MetricsResponse | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/metrics?limit=200");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat metrics.");
      setData(json as MetricsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat metrics.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    void load();
  }, [mounted, load]);

  function exportCsv() {
    if (!data) return;
    const rows = [
      [
        "created_at",
        "query",
        "retrieval_mode",
        "retrieve_ms",
        "generate_ms",
        "total_ms",
        "top_k",
        "citation_count",
        "citation_filenames",
      ],
      ...data.logs.map((l) => [
        l.createdAt,
        l.query,
        l.retrievalMode,
        String(l.retrieveMs),
        String(l.generateMs),
        String(l.totalMs),
        String(l.topK),
        String(l.citationCount),
        l.citationFilenames.join("|"),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lumen-metrics-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!mounted) {
    return (
      <main className="min-h-screen px-6 py-10 text-sm text-ink-soft">
        Memuat metrics…
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <AppHeader title="Query Metrics" />

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
        <section className="flex flex-wrap items-end justify-between gap-3 animate-fade-up">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
              Latency & citation log
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-ink-soft">
              Log query milik akunmu untuk analisis bab hasil: waktu retrieve,
              generate, total, dan jumlah sitasi.
            </p>
          </div>
          <div className="flex gap-2">
            <Btn
              className="!text-xs"
              disabled={busy}
              onClick={() => void load()}
            >
              {busy ? "Memuat…" : "Refresh"}
            </Btn>
            <Btn
              variant="secondary"
              className="!text-xs"
              disabled={!data?.logs.length}
              onClick={exportCsv}
            >
              Export CSV
            </Btn>
          </div>
        </section>

        {error && (
          <p className="text-sm text-amber-800" role="alert">
            {error}
          </p>
        )}

        {data && (
          <section className="grid animate-fade-up gap-3 sm:grid-cols-4">
            <Stat label="Log" value={String(data.summary.count)} />
            <Stat label="Avg total" value={`${data.summary.avgTotalMs} ms`} />
            <Stat
              label="Avg retrieve"
              value={`${data.summary.avgRetrieveMs} ms`}
            />
            <Stat
              label="Avg citations"
              value={String(data.summary.avgCitationCount)}
            />
          </section>
        )}

        <section className="overflow-x-auto rounded-2xl border border-ink/10 bg-white/60 animate-fade-up">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-ink/10 text-ink-soft">
              <tr>
                <th className="px-3 py-3 font-semibold">Waktu</th>
                <th className="px-3 py-3 font-semibold">Query</th>
                <th className="px-3 py-3 font-semibold">Mode</th>
                <th className="px-3 py-3 font-semibold">Retrieve</th>
                <th className="px-3 py-3 font-semibold">Generate</th>
                <th className="px-3 py-3 font-semibold">Total</th>
                <th className="px-3 py-3 font-semibold">Citations</th>
              </tr>
            </thead>
            <tbody>
              {!data?.logs.length && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-ink-soft">
                    Belum ada log. Chat di Desk atau jalankan Experiments dulu.
                  </td>
                </tr>
              )}
              {data?.logs.map((log) => (
                <tr key={log.id} className="border-t border-ink/5 align-top">
                  <td className="px-3 py-3 whitespace-nowrap text-ink-soft">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 max-w-xs text-ink">{log.query}</td>
                  <td className="px-3 py-3">{log.retrievalMode}</td>
                  <td className="px-3 py-3">{log.retrieveMs} ms</td>
                  <td className="px-3 py-3">{log.generateMs} ms</td>
                  <td className="px-3 py-3 font-semibold">{log.totalMs} ms</td>
                  <td className="px-3 py-3">
                    {log.citationCount}
                    {log.citationFilenames.length > 0 && (
                      <p className="mt-1 text-[10px] text-ink-soft">
                        {log.citationFilenames.join(", ")}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Panel>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
        {label}
      </p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
        {value}
      </p>
    </Panel>
  );
}
