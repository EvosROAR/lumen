import { promises as fs } from "fs";
import path from "path";
import { getSupabase, hasSupabase } from "@/lib/supabase";
import type { ChunkRecord, DocumentMeta, KnowledgeStore } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const SEED_PATH = path.join(DATA_DIR, "seed-store.json");

const emptyStore = (): KnowledgeStore => ({
  documents: [],
  chunks: [],
});

/**
 * Read-only only when explicitly forced, or on Vercel without Supabase.
 * With Supabase configured, upload/persist works in production.
 */
export function isDemoMode() {
  if (
    process.env.LUMEN_DEMO_MODE === "1" ||
    process.env.LUMEN_DEMO_MODE === "true"
  ) {
    return true;
  }
  if (process.env.LUMEN_DEMO_MODE === "0" || process.env.LUMEN_DEMO_MODE === "false") {
    return false;
  }
  return Boolean(process.env.VERCEL) && !hasSupabase();
}

export function usingSupabaseStore() {
  return hasSupabase();
}

async function readJsonStore(filePath: string): Promise<KnowledgeStore | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as KnowledgeStore;
    return {
      documents: parsed.documents ?? [],
      chunks: parsed.chunks ?? [],
    };
  } catch {
    return null;
  }
}

async function readSupabaseStore(): Promise<KnowledgeStore> {
  const supabase = getSupabase();

  const [{ data: docs, error: docErr }, { data: chunks, error: chunkErr }] =
    await Promise.all([
      supabase
        .from("lumen_documents")
        .select("id,title,filename,chars,chunks,created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("lumen_chunks")
        .select(
          "id,document_id,title,filename,chunk_index,content,embedding",
        ),
    ]);

  if (docErr) throw new Error(`Supabase documents: ${docErr.message}`);
  if (chunkErr) throw new Error(`Supabase chunks: ${chunkErr.message}`);

  const documents: DocumentMeta[] = (docs ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    filename: d.filename,
    chars: d.chars,
    chunks: d.chunks,
    createdAt: d.created_at,
  }));

  const chunkRecords: ChunkRecord[] = (chunks ?? []).map((c) => ({
    id: c.id,
    documentId: c.document_id,
    title: c.title,
    filename: c.filename,
    index: c.chunk_index,
    text: c.content,
    embedding: Array.isArray(c.embedding) ? c.embedding : [],
  }));

  return { documents, chunks: chunkRecords };
}

export async function readStore(): Promise<KnowledgeStore> {
  if (hasSupabase()) {
    return readSupabaseStore();
  }

  // Local / seed fallback
  if (isDemoMode()) {
    const seed = await readJsonStore(SEED_PATH);
    if (seed && (seed.documents.length > 0 || seed.chunks.length > 0)) {
      return seed;
    }
  }

  const local = await readJsonStore(STORE_PATH);
  if (local) return local;

  const seed = await readJsonStore(SEED_PATH);
  return seed ?? emptyStore();
}

export async function writeStore(store: KnowledgeStore): Promise<void> {
  if (isDemoMode()) {
    throw new Error(
      "Mode demo read-only: upload/hapus dokumen dinonaktifkan. Sambungkan Supabase untuk persistensi production.",
    );
  }

  if (hasSupabase()) {
    const supabase = getSupabase();
    // Full replace (used rarely — prefer saveDocument/removeDocument)
    const { error: delChunkErr } = await supabase
      .from("lumen_chunks")
      .delete()
      .neq("id", "");
    if (delChunkErr) throw new Error(delChunkErr.message);

    const { error: delDocErr } = await supabase
      .from("lumen_documents")
      .delete()
      .neq("id", "");
    if (delDocErr) throw new Error(delDocErr.message);

    if (store.documents.length) {
      const { error } = await supabase.from("lumen_documents").insert(
        store.documents.map((d) => ({
          id: d.id,
          title: d.title,
          filename: d.filename,
          chars: d.chars,
          chunks: d.chunks,
          created_at: d.createdAt,
        })),
      );
      if (error) throw new Error(error.message);
    }

    if (store.chunks.length) {
      const { error } = await supabase.from("lumen_chunks").insert(
        store.chunks.map((c) => ({
          id: c.id,
          document_id: c.documentId,
          title: c.title,
          filename: c.filename,
          chunk_index: c.index,
          content: c.text,
          embedding: c.embedding,
        })),
      );
      if (error) throw new Error(error.message);
    }
    return;
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function saveDocument(
  meta: DocumentMeta,
  chunks: ChunkRecord[],
): Promise<void> {
  if (isDemoMode()) {
    throw new Error(
      "Mode demo read-only: upload dinonaktifkan. Sambungkan Supabase untuk mengaktifkan upload.",
    );
  }

  if (hasSupabase()) {
    const supabase = getSupabase();
    const { error: docErr } = await supabase.from("lumen_documents").insert({
      id: meta.id,
      title: meta.title,
      filename: meta.filename,
      chars: meta.chars,
      chunks: meta.chunks,
      created_at: meta.createdAt,
    });
    if (docErr) throw new Error(docErr.message);

    if (chunks.length) {
      const { error: chunkErr } = await supabase.from("lumen_chunks").insert(
        chunks.map((c) => ({
          id: c.id,
          document_id: c.documentId,
          title: c.title,
          filename: c.filename,
          chunk_index: c.index,
          content: c.text,
          embedding: c.embedding,
        })),
      );
      if (chunkErr) throw new Error(chunkErr.message);
    }
    return;
  }

  const store = await readStore();
  store.documents.unshift(meta);
  store.chunks.push(...chunks);
  await writeStore(store);
}

export async function removeDocument(documentId: string): Promise<void> {
  if (isDemoMode()) {
    throw new Error(
      "Mode demo read-only: hapus dokumen dinonaktifkan. Sambungkan Supabase untuk mengaktifkan hapus.",
    );
  }

  if (hasSupabase()) {
    const supabase = getSupabase();
    // chunks cascade on FK, but delete doc is enough
    const { error } = await supabase
      .from("lumen_documents")
      .delete()
      .eq("id", documentId);
    if (error) throw new Error(error.message);
    return;
  }

  const store = await readStore();
  store.documents = store.documents.filter((d) => d.id !== documentId);
  store.chunks = store.chunks.filter((c) => c.documentId !== documentId);
  await writeStore(store);
}

export async function clearStore(): Promise<void> {
  if (isDemoMode()) {
    throw new Error(
      "Mode demo read-only: clear store dinonaktifkan. Sambungkan Supabase untuk reset data.",
    );
  }

  if (hasSupabase()) {
    const supabase = getSupabase();
    const { error: chunkErr } = await supabase
      .from("lumen_chunks")
      .delete()
      .neq("id", "");
    if (chunkErr) throw new Error(chunkErr.message);
    const { error: docErr } = await supabase
      .from("lumen_documents")
      .delete()
      .neq("id", "");
    if (docErr) throw new Error(docErr.message);
    return;
  }

  await writeStore(emptyStore());
}

export async function replaceChunkEmbeddings(
  chunks: ChunkRecord[],
): Promise<void> {
  if (isDemoMode() || chunks.length === 0) return;

  if (hasSupabase()) {
    const supabase = getSupabase();
    for (const chunk of chunks) {
      const { error } = await supabase
        .from("lumen_chunks")
        .update({ embedding: chunk.embedding })
        .eq("id", chunk.id);
      if (error) throw new Error(error.message);
    }
    return;
  }

  const store = await readStore();
  const byId = new Map(chunks.map((c) => [c.id, c.embedding]));
  store.chunks = store.chunks.map((c) =>
    byId.has(c.id) ? { ...c, embedding: byId.get(c.id)! } : c,
  );
  await writeStore(store);
}
