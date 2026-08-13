/** Sanitize prior turns so a degenerate/looping reply doesn't poison the next answer. */

function collapseRepeatedParagraphs(text: string): string {
  const parts = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 3) return text;

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const key = part.replace(/\s+/g, " ").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(part);
    if (unique.length >= 4) break;
  }

  if (parts.length >= unique.length * 2) {
    return (
      unique.join("\n\n") +
      "\n\n[…jawaban sebelumnya dipotong karena pengulangan…]"
    );
  }
  return text;
}

function collapseRepeatedSentences(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length < 8) return text;

  const kept: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const sentence of sentences) {
    const key = sentence.replace(/\s+/g, " ").trim().toLowerCase();
    if (key.length >= 24 && seen.has(key)) {
      skipped += 1;
      continue;
    }
    if (key.length >= 24) seen.add(key);
    kept.push(sentence);
    if (kept.length >= 14) break;
  }

  if (skipped >= 3 || kept.length < sentences.length * 0.5) {
    return kept.join(" ") + " […]";
  }
  return text;
}

export function sanitizeHistoryContent(
  content: string,
  role: "user" | "assistant" | "system",
): string {
  let text = content.trim();
  if (!text) return text;

  text = collapseRepeatedParagraphs(text);
  text = collapseRepeatedSentences(text);

  const maxLen = role === "assistant" ? 1200 : 900;
  if (text.length > maxLen) {
    text = `${text.slice(0, maxLen)}…`;
  }
  return text;
}

/** Assistant wrongly claimed an indexed doc was missing / unloadable. */
export function isFalseLibraryRefusal(content: string): boolean {
  const t = content.toLowerCase();
  return (
    /tidak tersedia/.test(t) ||
    /belum (ter)?indeks/.test(t) ||
    /pustaka terindeks/.test(t) ||
    /silakan unggah/.test(t) ||
    /tidak (dapat|bisa).{0,100}(menjelaskan|menjawab|menunjukkan)/.test(t) ||
    /tidak memiliki informasi lebih lanjut/.test(t) ||
    /file tersebut tidak ada di pustaka/.test(t)
  );
}

/**
 * Hybrid history policy:
 * - With retrieval hits: use recent user questions only. Old assistant refusals in a
 *   "broken" room must never override grounded context.
 * - Without hits: drop false library-refusal assistant turns so the room can recover;
 *   keep healthy assistant replies + user turns.
 */
export function selectMessagesForGeneration(
  messages: { role: string; content: string }[],
  hasContext: boolean,
): { role: string; content: string }[] {
  if (hasContext) {
    return messages.filter((m) => m.role === "user").slice(-4);
  }

  return messages.filter(
    (m) => !(m.role === "assistant" && isFalseLibraryRefusal(m.content)),
  );
}

export function buildChatHistory(
  messages: { role: string; content: string }[],
  limit = 8,
): { role: "user" | "assistant"; content: string }[] {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-limit)
    .map((m) => {
      const role = m.role as "user" | "assistant";
      return {
        role,
        content: sanitizeHistoryContent(m.content, role),
      };
    });
}
