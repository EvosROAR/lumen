/** Build UI suggestion chips from golden cases and/or indexed documents. */
export function buildQuerySuggestions(input: {
  goldenQuestions?: string[];
  documents?: { title: string; filename: string }[];
  limit?: number;
}): string[] {
  const limit = input.limit ?? 6;
  const fromGolden = (input.goldenQuestions ?? [])
    .map((q) => q.trim())
    .filter(Boolean);

  if (fromGolden.length > 0) {
    return [...new Set(fromGolden)].slice(0, limit);
  }

  const docs = input.documents ?? [];
  if (docs.length === 0) return [];

  const fromDocs: string[] = [];
  for (const doc of docs.slice(0, 4)) {
    const label = (doc.title || doc.filename).trim();
    if (!label) continue;
    fromDocs.push(`Apa isi utama dokumen "${label}"?`);
    fromDocs.push(`Sebutkan poin penting dalam ${doc.filename}`);
  }

  return [...new Set(fromDocs)].slice(0, limit);
}
