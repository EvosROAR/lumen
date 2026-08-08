import type { SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";
import { hasSupabasePublic } from "@/lib/supabase/admin";
import type { Citation, ConversationMeta, StoredMessage } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");

function slugId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function convPath(userId: string) {
  return path.join(DATA_DIR, "users", userId, "conversations.json");
}

type FileConvStore = {
  conversations: ConversationMeta[];
  messages: StoredMessage[];
};

async function readFileStore(userId: string): Promise<FileConvStore> {
  try {
    const raw = await fs.readFile(convPath(userId), "utf8");
    const parsed = JSON.parse(raw) as FileConvStore;
    return {
      conversations: parsed.conversations ?? [],
      messages: parsed.messages ?? [],
    };
  } catch {
    return { conversations: [], messages: [] };
  }
}

async function writeFileStore(userId: string, store: FileConvStore) {
  await fs.mkdir(path.dirname(convPath(userId)), { recursive: true });
  await fs.writeFile(convPath(userId), JSON.stringify(store, null, 2), "utf8");
}

export async function listConversations(
  userId: string,
  supabase?: SupabaseClient,
): Promise<ConversationMeta[]> {
  if (supabase && hasSupabasePublic()) {
    const { data, error } = await supabase
      .from("lumen_conversations")
      .select("id,title,created_at,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));
  }

  const store = await readFileStore(userId);
  return [...store.conversations].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export async function createConversation(
  userId: string,
  title: string,
  supabase?: SupabaseClient,
): Promise<ConversationMeta> {
  const now = new Date().toISOString();
  const meta: ConversationMeta = {
    id: slugId("conv"),
    title: title.trim() || "Percakapan baru",
    createdAt: now,
    updatedAt: now,
  };

  if (supabase && hasSupabasePublic()) {
    const { error } = await supabase.from("lumen_conversations").insert({
      id: meta.id,
      user_id: userId,
      title: meta.title,
      created_at: meta.createdAt,
      updated_at: meta.updatedAt,
    });
    if (error) throw new Error(error.message);
    return meta;
  }

  const store = await readFileStore(userId);
  store.conversations.unshift(meta);
  await writeFileStore(userId, store);
  return meta;
}

export async function getConversationMessages(
  userId: string,
  conversationId: string,
  supabase?: SupabaseClient,
): Promise<StoredMessage[]> {
  if (supabase && hasSupabasePublic()) {
    const { data: conv, error: convErr } = await supabase
      .from("lumen_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (convErr) throw new Error(convErr.message);
    if (!conv) throw new Error("Percakapan tidak ditemukan.");

    const { data, error } = await supabase
      .from("lumen_messages")
      .select("id,conversation_id,role,content,citations,created_at")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    return (data ?? []).map((m) => ({
      id: m.id,
      conversationId: m.conversation_id,
      role: m.role as StoredMessage["role"],
      content: m.content,
      citations: (m.citations as Citation[] | null) ?? null,
      createdAt: m.created_at,
    }));
  }

  const store = await readFileStore(userId);
  if (!store.conversations.some((c) => c.id === conversationId)) {
    throw new Error("Percakapan tidak ditemukan.");
  }
  return store.messages
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function appendMessage(
  userId: string,
  conversationId: string,
  input: {
    role: "user" | "assistant" | "system";
    content: string;
    citations?: Citation[] | null;
  },
  supabase?: SupabaseClient,
): Promise<StoredMessage> {
  const message: StoredMessage = {
    id: slugId("msg"),
    conversationId,
    role: input.role,
    content: input.content,
    citations: input.citations ?? null,
    createdAt: new Date().toISOString(),
  };
  const now = new Date().toISOString();

  if (supabase && hasSupabasePublic()) {
    const { error } = await supabase.from("lumen_messages").insert({
      id: message.id,
      conversation_id: conversationId,
      user_id: userId,
      role: message.role,
      content: message.content,
      citations: message.citations,
      created_at: message.createdAt,
    });
    if (error) throw new Error(error.message);

    await supabase
      .from("lumen_conversations")
      .update({ updated_at: now })
      .eq("id", conversationId)
      .eq("user_id", userId);

    return message;
  }

  const store = await readFileStore(userId);
  const conv = store.conversations.find((c) => c.id === conversationId);
  if (!conv) throw new Error("Percakapan tidak ditemukan.");
  conv.updatedAt = now;
  store.messages.push(message);
  await writeFileStore(userId, store);
  return message;
}

export async function touchConversationTitle(
  userId: string,
  conversationId: string,
  title: string,
  supabase?: SupabaseClient,
) {
  const trimmed = title.trim().slice(0, 80) || "Percakapan baru";
  const now = new Date().toISOString();

  if (supabase && hasSupabasePublic()) {
    await supabase
      .from("lumen_conversations")
      .update({ title: trimmed, updated_at: now })
      .eq("id", conversationId)
      .eq("user_id", userId);
    return;
  }

  const store = await readFileStore(userId);
  const conv = store.conversations.find((c) => c.id === conversationId);
  if (conv) {
    conv.title = trimmed;
    conv.updatedAt = now;
    await writeFileStore(userId, store);
  }
}
