# Lumen — AI Knowledge Desk

Proyek portofolio **AI Developer**: knowledge desk berbasis **RAG** dengan hybrid retrieval, sitasi sumber, evaluasi golden set, dan upload PDF.

## Fitur (siap interview)

| Kompetensi | Implementasi |
| --- | --- |
| Ingest | `.txt` / `.md` / `.pdf` + 10 dokumen contoh |
| Chunking | Overlapping windows + boundary-aware splits |
| Embedding | Lokal deterministik (gratis) — bisa diganti ke API |
| Hybrid retrieval | **0.55 vector + 0.45 BM25** |
| Generation | Groq (`llama-3.1-8b-instant`) streaming + sitasi |
| Evaluation | **15 golden questions** → Recall@K & Precision@K di `/eval` |
| Summarize | **Map-reduce** semua dokumen via tombol **Rangkum semua** |

## Arsitektur

```
Dokumen (.md/.pdf)
   → extract → chunk → embed → store.json
                                      ↑
Pertanyaan → embed + BM25 → hybrid rank → top-K konteks
                                      ↓
                         Groq stream jawaban + sitasi
                                      ↓
                         /eval: golden Recall@K / P@K
```

## Stack

- Next.js App Router + TypeScript + Tailwind CSS 4
- OpenAI-compatible client → **Groq** (chat)
- PDF: `pdf-parse`
- Knowledge store lokal (`data/store.json`) — mudah diganti pgvector

## Setup (gratis)

```bash
cd lumen
npm install
cp .env.example .env.local
# isi GROQ_API_KEY=gsk_... dari https://console.groq.com/keys
npm run dev
```

Opsional seed indeks:

```bash
npm run seed
```

Buka:

- App: [http://localhost:3000](http://localhost:3000)
- Desk: [http://localhost:3000/desk](http://localhost:3000/desk)
- Eval: [http://localhost:3000/eval](http://localhost:3000/eval)

## Cara demo (30 detik)

1. Di Desk → **Muat 10 dokumen contoh**
2. Tanya: *Berapa hari cuti tahunan karyawan?*
3. Lihat jawaban streaming + skor sumber
4. Buka **/eval** → lihat Recall@4 / Precision@4

## Endpoint API

- `GET /api/documents`
- `POST /api/ingest` — file / paste / `{ "mode": "samples" }`
- `DELETE /api/documents` — `{ "id": "..." }`
- `POST /api/chat` — NDJSON stream: `citations` → `token*` → `done`
- `POST /api/summarize` — map-reduce rangkuman seluruh (atau sebagian) dokumen
- `GET /api/eval?k=4` — laporan golden evaluation

## Metrik yang kamu bisa jelasin di interview

- **Recall@K**: apakah dokumen yang benar muncul di top-K?
- **Precision@K**: berapa proporsi hasil top-K yang relevan?
- **Hybrid retrieval**: kenapa pure embedding lemah di keyword eksak (angka, kode file), dan BM25 menutupinya

## Roadmap produksi

- Ganti store → Postgres + pgvector
- Embedding model khusus (`text-embedding-3-small` / `gemini-embedding-001`)
- Auth multi-tenant + ACL dokumen
- Observability: latency, token cost, citation coverage
- CI yang menjalankan `/api/eval` sebagai quality gate

## Deploy with Supabase (upload aktif di production)

Supabase **free tier** cukup untuk demo portofolio.

1. Buat project gratis: [supabase.com](https://supabase.com)
2. **SQL Editor** → jalankan isi `supabase/schema.sql`
3. **Settings → API** → salin:
   - Project URL → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
4. Isi `.env.local` (lihat `.env.example`)
5. Seed data contoh:

```bash
npm install
npm run seed:supabase
```

6. Vercel → Project → Settings → Environment Variables → tambah `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` → Redeploy

Setelah itu badge **Supabase** muncul di Desk, dan upload/hapus aktif di web live.
