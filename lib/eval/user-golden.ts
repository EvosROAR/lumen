import type { SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";
import { GOLDEN_CASES, type GoldenCase } from "@/lib/eval/golden";
import { hasSupabasePublic } from "@/lib/supabase/admin";
import type { KnowledgeStore } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");

function slugId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function goldenPath(userId: string) {
  return path.join(DATA_DIR, "users", userId, "golden.json");
}

async function readFileCases(userId: string): Promise<GoldenCase[]> {
  try {
    const raw = await fs.readFile(goldenPath(userId), "utf8");
    return (JSON.parse(raw) as GoldenCase[]) ?? [];
  } catch {
    return [];
  }
}

async function writeFileCases(userId: string, cases: GoldenCase[]) {
  await fs.mkdir(path.dirname(goldenPath(userId)), { recursive: true });
  await fs.writeFile(goldenPath(userId), JSON.stringify(cases, null, 2), "utf8");
}

export async function listUserGoldenCases(
  userId: string,
  supabase?: SupabaseClient,
): Promise<GoldenCase[]> {
  if (supabase && hasSupabasePublic()) {
    const { data, error } = await supabase
      .from("lumen_golden_cases")
      .select("id,question,expected_filenames,expected_answer_hint")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      question: row.question,
      expectedFilenames: Array.isArray(row.expected_filenames)
        ? (row.expected_filenames as string[])
        : [],
      expectedAnswerHint: row.expected_answer_hint || "",
    }));
  }
  return readFileCases(userId);
}

export async function createUserGoldenCase(
  userId: string,
  input: {
    question: string;
    expectedFilenames: string[];
    expectedAnswerHint?: string;
  },
  supabase?: SupabaseClient,
): Promise<GoldenCase> {
  const question = input.question.trim();
  const expectedFilenames = input.expectedFilenames
    .map((f) => f.trim())
    .filter(Boolean);
  if (!question) throw new Error("Pertanyaan wajib.");
  if (expectedFilenames.length === 0) {
    throw new Error("Minimal satu filename dokumen expected.");
  }

  const item: GoldenCase = {
    id: slugId("gold"),
    question,
    expectedFilenames,
    expectedAnswerHint: input.expectedAnswerHint?.trim() || "",
  };

  if (supabase && hasSupabasePublic()) {
    const { error } = await supabase.from("lumen_golden_cases").insert({
      id: item.id,
      user_id: userId,
      question: item.question,
      expected_filenames: item.expectedFilenames,
      expected_answer_hint: item.expectedAnswerHint,
    });
    if (error) throw new Error(error.message);
    return item;
  }

  const cases = await readFileCases(userId);
  cases.push(item);
  await writeFileCases(userId, cases);
  return item;
}

export async function deleteUserGoldenCase(
  userId: string,
  id: string,
  supabase?: SupabaseClient,
): Promise<void> {
  if (supabase && hasSupabasePublic()) {
    const { error } = await supabase
      .from("lumen_golden_cases")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return;
  }
  const cases = await readFileCases(userId);
  await writeFileCases(
    userId,
    cases.filter((c) => c.id !== id),
  );
}

export type ResolvedGoldenSet = {
  cases: GoldenCase[];
  source: "custom" | "sample" | "none";
  message: string | null;
  availableFilenames: string[];
};

/** Prefer user-defined cases; else sample cases that match files in the corpus. */
export async function resolveGoldenCases(
  userId: string,
  store: KnowledgeStore,
  supabase?: SupabaseClient,
): Promise<ResolvedGoldenSet> {
  const availableFilenames = store.documents.map((d) => d.filename);
  const available = new Set(availableFilenames);

  const custom = await listUserGoldenCases(userId, supabase);
  if (custom.length > 0) {
    return {
      cases: custom,
      source: "custom",
      message: null,
      availableFilenames,
    };
  }

  const sampleMatched = GOLDEN_CASES.filter((g) =>
    g.expectedFilenames.some((f) => available.has(f)),
  );

  if (sampleMatched.length > 0) {
    return {
      cases: sampleMatched,
      source: "sample",
      message:
        "Memakai golden set contoh (cocok dengan dokumen sample di pustaka).",
      availableFilenames,
    };
  }

  return {
    cases: [],
    source: "none",
    message:
      "Belum ada golden set untuk dokumenmu. Tambah pertanyaan eval di bawah (pilih filename dokumen yang diunggah), atau muat dokumen contoh di Desk.",
    availableFilenames,
  };
}
