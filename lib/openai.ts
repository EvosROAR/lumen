import OpenAI from "openai";

export function hasChatKey() {
  return Boolean(
    process.env.GROQ_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim(),
  );
}

/** @deprecated use hasChatKey */
export function hasOpenAIKey() {
  return hasChatKey();
}

function usingGroq() {
  const base = process.env.OPENAI_BASE_URL || "";
  return (
    Boolean(process.env.GROQ_API_KEY?.trim()) ||
    base.includes("api.groq.com") ||
    process.env.AI_CHAT_PROVIDER === "groq"
  );
}

function usingGemini() {
  return (process.env.OPENAI_BASE_URL || "").includes(
    "generativelanguage.googleapis.com",
  );
}

export function getChatClient() {
  if (usingGroq()) {
    const apiKey =
      process.env.GROQ_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "GROQ_API_KEY belum di-set. Ambil gratis di https://console.groq.com/keys",
      );
    }
    return new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY belum di-set. Salin .env.example ke .env.local lalu isi API key-mu.",
    );
  }

  return new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
}

/** @deprecated use getChatClient */
export function getOpenAI() {
  return getChatClient();
}

export function chatModel() {
  if (process.env.OPENAI_CHAT_MODEL) return process.env.OPENAI_CHAT_MODEL;
  if (usingGroq()) return "llama-3.1-8b-instant";
  if (usingGemini()) return "gemini-flash-latest";
  return "gpt-4o-mini";
}

export function chatModelCandidates(): string[] {
  const primary = chatModel();
  const extras = usingGroq()
    ? ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "gemma2-9b-it"]
    : usingGemini()
      ? ["gemini-flash-latest", "gemini-3.5-flash", "gemini-2.0-flash"]
      : ["gpt-4o-mini", "gpt-4o"];
  return [...new Set([primary, ...extras])];
}

export function embedProvider(): "local" | "api" {
  const raw = (process.env.EMBED_PROVIDER || "local").toLowerCase();
  return raw === "api" ? "api" : "local";
}

export function embedModel() {
  if (process.env.OPENAI_EMBED_MODEL) return process.env.OPENAI_EMBED_MODEL;
  if (usingGemini()) return "gemini-embedding-001";
  return "text-embedding-3-small";
}
