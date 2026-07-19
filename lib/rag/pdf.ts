import { PDFParse } from "pdf-parse";

const PAGE_MARK_RE = /^[\s\-–—]*\d+(\s*(of|\/|dari)\s*\d+)?[\s\-–—]*$/gim;

function cleanPdfText(raw: string): string {
  return raw
    .replace(/\u0000/g, "")
    .replace(PAGE_MARK_RE, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isMostlyGarbage(text: string): boolean {
  const letters = (text.match(/\p{L}/gu) || []).length;
  return text.length < 80 || letters < 40;
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = cleanPdfText(result.text || "");

    if (!text || isMostlyGarbage(text)) {
      throw new Error(
        "PDF hampir tidak punya teks yang bisa dibaca. Kemungkinan resume-mu berupa hasil scan/gambar (bukan PDF teks). Solusi: export ulang sebagai PDF teks dari Word/Google Docs, atau tempel teks resume lewat “Tempel teks”.",
      );
    }

    return text;
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
