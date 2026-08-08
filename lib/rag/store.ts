import { promises as fs } from "fs";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasSupabasePublic } from "@/lib/supabase/admin";
import type { ChunkRecord, DocumentMeta, KnowledgeStore } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const SEED_PATH = path.join(DATA_DIR, "seed-store.json");

const emptyStore = (): KnowledgeStore => ({
  documents: [],
  chunks: [],
});

export function isDemoMode() {
  if (
    process.env.LUMEN_DEMO_MODE === "1" ||
    process.env.LUMEN_DEMO_MODE === "true"
  ) {
    return true;
  }
  if (
    process.env.LUMEN_DEMO_MODE === "0" ||
    process.env.LUMEN_DEMO_MODE === "false"
  ) {
    return false;
  }
  return false;
}

export function usingSupabaseStore() {
  return hasSupabasePublic();
}

function userStorePath(userId: string) {
  return path.join(DATA_DIR, "users", userId, "store.json");
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

async function writeJsonStore(filePath: string, store: KnowledgeStore) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(store, null, 2), "utf8");
}

async function readSupabaseStore(
  supabase: SupabaseClient,
  userId: string,
): Promise<KnowledgeStore> {
  const [{ data: docs, error: docErr }, { data: chunks, error: chunkErr }] =
    await Promise.all([
      supabase
        .from("lumen_documents")
        .select("id,title,filename,chars,chunks,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("lumen_chunks")
        .select("id,document_id,title,filename,chunk_index,content,embedding")
        .eq("user_id", userId),
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

export async function readStore(
  userId: string,
  supabase?: SupabaseClient,
): Promise<KnowledgeStore> {
  if (supabase && hasSupabasePublic()) {
    return readSupabaseStore(supabase, userId);
  }

  const local = await readJsonStore(userStorePath(userId));
  if (local) return local;

  // First-time local user: empty store (seed is opt-in via ingest samples)
  return emptyStore();
}

export async function saveDocument(
  userId: string,
  meta: DocumentMeta,
  chunks: ChunkRecord[],
  supabase?: SupabaseClient,
): Promise<void> {
  if (isDemoMode()) {
    throw new Error("Mode demo read-only: upload dinonaktifkan.");
  }

  if (supabase && hasSupabasePublic()) {
    const { error: docErr } = await supabase.from("lumen_documents").insert({
      id: meta.id,
      user_id: userId,
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
          user_id: userId,
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

  const store = await readStore(userId);
  store.documents.unshift(meta);
  store.chunks.push(...chunks);
  await writeJsonStore(userStorePath(userId), store);
}

export async function removeDocument(
  userId: string,
  documentId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  if (isDemoMode()) {
    throw new Error("Mode demo read-only: hapus dokumen dinonaktifkan.");
  }

  if (supabase && hasSupabasePublic()) {
    const { error } = await supabase
      .from("lumen_documents")
      .delete()
      .eq("id", documentId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return;
  }

  const store = await readStore(userId);
  store.documents = store.documents.filter((d) => d.id !== documentId);
  store.chunks = store.chunks.filter((c) => c.documentId !== documentId);
  await writeJsonStore(userStorePath(userId), store);
}

export async function clearStore(
  userId: string,
  supabase?: SupabaseClient,
): Promise<void> {
  if (isDemoMode()) {
    throw new Error("Mode demo read-only: clear store dinonaktifkan.");
  }

  if (supabase && hasSupabasePublic()) {
    const { error: chunkErr } = await supabase
      .from("lumen_chunks")
      .delete()
      .eq("user_id", userId);
    if (chunkErr) throw new Error(chunkErr.message);
    const { error: docErr } = await supabase
      .from("lumen_documents")
      .delete()
      .eq("user_id", userId);
    if (docErr) throw new Error(docErr.message);
    return;
  }

  await writeJsonStore(userStorePath(userId), emptyStore());
}

export async function replaceChunkEmbeddings(
  userId: string,
  chunks: ChunkRecord[],
  supabase?: SupabaseClient,
): Promise<void> {
  if (isDemoMode() || chunks.length === 0) return;

  if (supabase && hasSupabasePublic()) {
    for (const chunk of chunks) {
      const { error } = await supabase
        .from("lumen_chunks")
        .update({ embedding: chunk.embedding })
        .eq("id", chunk.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    }
    return;
  }

  const store = await readStore(userId);
  const byId = new Map(chunks.map((c) => [c.id, c.embedding]));
  store.chunks = store.chunks.map((c) =>
    byId.has(c.id) ? { ...c, embedding: byId.get(c.id)! } : c,
  );
  await writeJsonStore(userStorePath(userId), store);
}

export async function readSeedStore(): Promise<KnowledgeStore | null> {
  return readJsonStore(SEED_PATH);
}
