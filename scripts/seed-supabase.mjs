/**
 * Seed Supabase for ONE user (after auth schema migration).
 * Usage:
 *   node --env-file=.env.local scripts/seed-supabase.mjs
 * Env:
 *   SEED_USER_ID=<uuid from auth.users>
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ws from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const url =
  process.env.SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const userId = process.env.SEED_USER_ID?.trim();

if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}
if (!userId) {
  console.error(
    "Set SEED_USER_ID to a user uuid from Supabase Auth → Users (after you register).",
  );
  process.exit(1);
}

const seed = JSON.parse(
  readFileSync(path.join(root, "data", "seed-store.json"), "utf8"),
);

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});

async function main() {
  console.log(`Clearing Lumen rows for user ${userId}...`);
  await supabase.from("lumen_chunks").delete().eq("user_id", userId);
  await supabase.from("lumen_documents").delete().eq("user_id", userId);

  const docs = seed.documents ?? [];
  const chunks = seed.chunks ?? [];

  if (docs.length) {
    const { error } = await supabase.from("lumen_documents").insert(
      docs.map((d) => ({
        id: d.id,
        user_id: userId,
        title: d.title,
        filename: d.filename,
        chars: d.chars,
        chunks: d.chunks,
        created_at: d.createdAt,
      })),
    );
    if (error) throw error;
  }

  if (chunks.length) {
    const batchSize = 50;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize).map((c) => ({
        id: c.id,
        user_id: userId,
        document_id: c.documentId,
        title: c.title,
        filename: c.filename,
        chunk_index: c.index,
        content: c.text,
        embedding: c.embedding,
      }));
      const { error } = await supabase.from("lumen_chunks").insert(batch);
      if (error) throw error;
    }
  }

  console.log(
    `Seeded ${docs.length} documents, ${chunks.length} chunks for user ${userId}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
