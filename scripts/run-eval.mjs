const base = process.env.LUMEN_BASE_URL || "http://localhost:3000";

const res = await fetch(`${base}/api/eval?k=4`);
if (!res.ok) {
  const body = await res.text();
  console.error("Eval failed:", res.status, body);
  process.exit(1);
}

const report = await res.json();
console.log(
  JSON.stringify(
    {
      recallAtK: report.recallAtK,
      avgPrecisionAtK: report.avgPrecisionAtK,
      hits: `${report.hits}/${report.total}`,
      corpus: `${report.documentCount} docs / ${report.chunkCount} chunks`,
    },
    null,
    2,
  ),
);

const misses = (report.cases || []).filter((c) => !c.hit);
if (misses.length) {
  console.log("\nMisses:");
  for (const m of misses) {
    console.log(`- ${m.id}: ${m.question}`);
  }
}
