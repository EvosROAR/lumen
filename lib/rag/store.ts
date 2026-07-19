import { promises as fs } from "fs";
import path from "path";
import type { KnowledgeStore } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const SEED_PATH = path.join(DATA_DIR, "seed-store.json");

const emptyStore = (): KnowledgeStore => ({
  documents: [],
  chunks: [],
});

/** Read-only demo for Vercel: baked-in seed, no persistent writes. */
export function isDemoMode() {
  return (
    process.env.LUMEN_DEMO_MODE === "1" ||
    process.env.LUMEN_DEMO_MODE === "true" ||
    Boolean(process.env.VERCEL)
  );
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

export async function readStore(): Promise<KnowledgeStore> {
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
      "Mode demo read-only: upload/hapus dokumen dinonaktifkan di deployment. Chat, eval, dan rangkum tetap jalan dari materi seed.",
    );
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function clearStore(): Promise<void> {
  await writeStore(emptyStore());
}
