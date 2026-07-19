type RetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  label?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableStatus(status: unknown): boolean {
  return status === 429 || status === 503 || status === 500;
}

export function getErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

export function friendlyApiError(error: unknown): string {
  const status = getErrorStatus(error);
  const raw = error instanceof Error ? error.message : String(error);

  if (status === 503) {
    return "Model provider lagi sibuk (503). Tunggu sebentar, lalu coba lagi.";
  }
  if (status === 429) {
    return "Batas rate limit terlampaui (429). Tunggu sebentar, lalu coba lagi.";
  }
  if (status === 404) {
    return "Model tidak ditemukan (404). Cek OPENAI_CHAT_MODEL di .env.local.";
  }
  if (status === 401 || status === 403) {
    return "API key ditolak. Cek GROQ_API_KEY di .env.local.";
  }
  return raw || "Permintaan ke model gagal.";
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 1200;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = getErrorStatus(error);
      const retryable = isRetryableStatus(status);
      if (!retryable || attempt === retries) break;
      const delay = baseDelayMs * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(friendlyApiError(lastError));
}
