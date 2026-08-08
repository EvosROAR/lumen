import type { SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";
import { hasSupabasePublic } from "@/lib/supabase/admin";
import type { QueryLog } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");

function slugId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function logsPath(userId: string) {
  return path.join(DATA_DIR, "users", userId, "query-logs.json");
}

async function readFileLogs(userId: string): Promise<QueryLog[]> {
  try {
    const raw = await fs.readFile(logsPath(userId), "utf8");
    return (JSON.parse(raw) as QueryLog[]) ?? [];
  } catch {
    return [];
  }
}

async function writeFileLogs(userId: string, logs: QueryLog[]) {
  await fs.mkdir(path.dirname(logsPath(userId)), { recursive: true });
  await fs.writeFile(logsPath(userId), JSON.stringify(logs, null, 2), "utf8");
}

export async function insertQueryLog(
  userId: string,
  input: Omit<QueryLog, "id" | "createdAt">,
  supabase?: SupabaseClient,
): Promise<QueryLog> {
  const log: QueryLog = {
    id: slugId("log"),
    createdAt: new Date().toISOString(),
    ...input,
  };

  if (supabase && hasSupabasePublic()) {
    const { error } = await supabase.from("lumen_query_logs").insert({
      id: log.id,
      user_id: userId,
      conversation_id: log.conversationId ?? null,
      query: log.query,
      retrieval_mode: log.retrievalMode,
      retrieve_ms: log.retrieveMs,
      generate_ms: log.generateMs,
      total_ms: log.totalMs,
      top_k: log.topK,
      citation_count: log.citationCount,
      citation_filenames: log.citationFilenames,
      created_at: log.createdAt,
    });
    if (error) throw new Error(error.message);
    return log;
  }

  const logs = await readFileLogs(userId);
  logs.unshift(log);
  await writeFileLogs(userId, logs.slice(0, 500));
  return log;
}

export async function listQueryLogs(
  userId: string,
  supabase?: SupabaseClient,
  limit = 100,
): Promise<QueryLog[]> {
  if (supabase && hasSupabasePublic()) {
    const { data, error } = await supabase
      .from("lumen_query_logs")
      .select(
        "id,conversation_id,query,retrieval_mode,retrieve_ms,generate_ms,total_ms,top_k,citation_count,citation_filenames,created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      query: row.query,
      retrievalMode: row.retrieval_mode,
      retrieveMs: row.retrieve_ms,
      generateMs: row.generate_ms,
      totalMs: row.total_ms,
      topK: row.top_k,
      citationCount: row.citation_count,
      citationFilenames: Array.isArray(row.citation_filenames)
        ? row.citation_filenames
        : [],
      createdAt: row.created_at,
    }));
  }

  const logs = await readFileLogs(userId);
  return logs.slice(0, limit);
}
