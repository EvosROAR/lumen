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

/**
 * Embedding client — separate from chat so Groq can stay for LLM while
 * Gemini/OpenAI handle vectors (Groq has no embeddings API).
 */
export function getEmbedClient() {
  const embedKey =
    process.env.EMBED_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    "";
  const embedBase =
    process.env.EMBED_BASE_URL?.trim() ||
    process.env.OPENAI_BASE_URL?.trim() ||
    "";

  if (!embedKey) {
    throw new Error(
      "EMBED_PROVIDER=api butuh EMBED_API_KEY (atau OPENAI_API_KEY). " +
        "Groq tidak menyediakan embeddings. Ambil Gemini gratis di https://aistudio.google.com/apikey",
    );
  }

  // Dedicated embed endpoint (recommended when chat uses Groq)
  if (process.env.EMBED_BASE_URL?.trim()) {
    return new OpenAI({
      apiKey: embedKey,
      baseURL: process.env.EMBED_BASE_URL.trim(),
    });
  }

  // OPENAI_BASE_URL points at Gemini
  if (embedBase.includes("generativelanguage.googleapis.com")) {
    return new OpenAI({ apiKey: embedKey, baseURL: embedBase });
  }

  // Plain OpenAI embeddings
  if (!usingGroq()) {
    return new OpenAI({
      apiKey: embedKey,
      baseURL: embedBase || undefined,
    });
  }

  // Chat is Groq but user set OPENAI_API_KEY for embeddings — default Gemini compat URL
  return new OpenAI({
    apiKey: embedKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });
}

/** @deprecated use getChatClient */
export function getOpenAI() {
  return getChatClient();
}

export function chatModel() {
  if (process.env.OPENAI_CHAT_MODEL) return process.env.OPENAI_CHAT_MODEL;
  // 8B free-tier TPM is too small for RAG prompts + long answers.
  if (usingGroq()) return "llama-3.3-70b-versatile";
  if (usingGemini()) return "gemini-flash-latest";
  return "gpt-4o-mini";
}

export function chatModelCandidates(): string[] {
  const primary = chatModel();
  const extras = usingGroq()
    ? ["llama-3.3-70b-versatile"]
    : usingGemini()
      ? ["gemini-flash-latest", "gemini-3.5-flash", "gemini-2.0-flash"]
      : ["gpt-4o-mini", "gpt-4o"];
  return [...new Set([primary, ...extras])];
}

/** Groq counts max_tokens toward TPM. 8B on-demand is ~6000 TPM. */
export function maxTokensForModel(model: string): number {
  if (model.includes("8b") || model.includes("gemma")) return 1536;
  return 4096;
}

export function embedProvider(): "local" | "api" {
  const raw = (process.env.EMBED_PROVIDER || "local").toLowerCase();
  return raw === "api" ? "api" : "local";
}

export function embedModel() {
  if (process.env.OPENAI_EMBED_MODEL) return process.env.OPENAI_EMBED_MODEL;
  const embedBase =
    process.env.EMBED_BASE_URL?.trim() ||
    process.env.OPENAI_BASE_URL?.trim() ||
    "";
  if (embedBase.includes("generativelanguage.googleapis.com")) {
    return "gemini-embedding-001";
  }
  if (usingGemini()) return "gemini-embedding-001";
  // Default when chat=Groq and embed key is used without explicit base
  if (usingGroq() && (process.env.EMBED_API_KEY || process.env.OPENAI_API_KEY)) {
    return "gemini-embedding-001";
  }
  return "text-embedding-3-small";
}
