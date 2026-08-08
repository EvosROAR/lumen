/** Safely parse fetch Response as JSON; explain HTML/error pages clearly. */
export async function readJsonResponse<T = unknown>(
  res: Response,
): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  const raw = await res.text();

  if (!raw.trim()) {
    throw new Error(`Respons kosong dari server (HTTP ${res.status}).`);
  }

  const looksHtml =
    contentType.includes("text/html") ||
    raw.trimStart().startsWith("<!DOCTYPE") ||
    raw.trimStart().startsWith("<html");

  if (looksHtml) {
    if (res.status === 401 || res.redirected || res.url.includes("/login")) {
      throw new Error("Sesi login habis atau belum masuk. Silakan login ulang.");
    }
    if (res.status === 413) {
      throw new Error(
        "File terlalu besar untuk diunggah. Coba PDF lebih kecil atau tempel teks.",
      );
    }
    throw new Error(
      `Server mengembalikan halaman HTML (HTTP ${res.status}), bukan JSON. ` +
        "Biasanya session habis, error server, atau file terlalu besar. Coba login ulang / refresh.",
    );
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(
      `Respons bukan JSON valid (HTTP ${res.status}): ${raw.slice(0, 120)}…`,
    );
  }
}
