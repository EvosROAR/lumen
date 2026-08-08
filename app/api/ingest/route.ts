import { NextResponse } from "next/server";
import { isAuthError, requireUser } from "@/lib/auth";
import { hasChatKey } from "@/lib/openai";
import { ingestDocument } from "@/lib/rag/ingest";
import { extractPdfText } from "@/lib/rag/pdf";
import { clearStore, isDemoMode } from "@/lib/rag/store";
import { SAMPLE_DOCUMENTS } from "@/lib/sample-docs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (isAuthError(auth)) return auth.error;

  if (isDemoMode()) {
    return NextResponse.json(
      { error: "Mode demo read-only: upload/muat dokumen dinonaktifkan." },
      { status: 403 },
    );
  }

  if (!hasChatKey()) {
    return NextResponse.json(
      {
        error:
          "GROQ_API_KEY belum dikonfigurasi. Ambil gratis di https://console.groq.com/keys lalu isi .env.local.",
      },
      { status: 503 },
    );
  }

  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        mode?: string;
        title?: string;
        filename?: string;
        content?: string;
      };

      if (body.mode === "samples") {
        await clearStore(auth.user.id, auth.supabase);
        const results = [];
        for (const sample of SAMPLE_DOCUMENTS) {
          results.push(
            await ingestDocument(auth.user.id, sample, auth.supabase),
          );
        }
        return NextResponse.json({ documents: results });
      }

      if (!body.content?.trim()) {
        return NextResponse.json({ error: "content wajib." }, { status: 400 });
      }

      const doc = await ingestDocument(
        auth.user.id,
        {
          title: body.title || "Untitled",
          filename: body.filename || "paste.txt",
          content: body.content,
        },
        auth.supabase,
      );
      return NextResponse.json({ document: doc });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file wajib." }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    const isText =
      name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".markdown");
    const isPdf = name.endsWith(".pdf");

    if (!isText && !isPdf) {
      return NextResponse.json(
        { error: "Format didukung: .txt, .md, .pdf" },
        { status: 400 },
      );
    }

    let content: string;
    if (isPdf) {
      const buffer = Buffer.from(await file.arrayBuffer());
      content = await extractPdfText(buffer);
    } else {
      content = await file.text();
    }

    const doc = await ingestDocument(
      auth.user.id,
      {
        title: file.name.replace(/\.(txt|md|markdown|pdf)$/i, ""),
        filename: file.name,
        content,
      },
      auth.supabase,
    );

    return NextResponse.json({ document: doc });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ingest gagal.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
