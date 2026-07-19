import { chunkText } from "@/lib/rag/chunk";
import { embedTexts } from "@/lib/rag/embed";
import { readStore, writeStore } from "@/lib/rag/store";
import type { ChunkRecord, DocumentMeta } from "@/lib/types";

function slugId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function ingestDocument(input: {
  title: string;
  filename: string;
  content: string;
}): Promise<DocumentMeta> {
  const content = input.content.trim();
  if (!content) {
    throw new Error("Dokumen kosong.");
  }

  const pieces = chunkText(content);
  if (pieces.length === 0) {
    throw new Error("Tidak ada potongan teks yang bisa di-index.");
  }

  const embeddings = await embedTexts(pieces);
  const documentId = slugId("doc");
  const meta: DocumentMeta = {
    id: documentId,
    title: input.title.trim() || input.filename,
    filename: input.filename,
    chars: content.length,
    chunks: pieces.length,
    createdAt: new Date().toISOString(),
  };

  const chunks: ChunkRecord[] = pieces.map((text, index) => ({
    id: `${documentId}_c${index}`,
    documentId,
    title: meta.title,
    filename: meta.filename,
    index,
    text,
    embedding: embeddings[index],
  }));

  const store = await readStore();
  store.documents.unshift(meta);
  store.chunks.push(...chunks);
  await writeStore(store);

  return meta;
}

export async function deleteDocument(documentId: string): Promise<void> {
  const store = await readStore();
  store.documents = store.documents.filter((d) => d.id !== documentId);
  store.chunks = store.chunks.filter((c) => c.documentId !== documentId);
  await writeStore(store);
}
