# Lumen — AI Knowledge Desk

Proyek **AI Developer / skripsi**: knowledge desk berbasis **RAG** dengan auth multi-user, hybrid retrieval, sitasi, eksperimen Vector/BM25/Hybrid, riwayat chat, dan logging latency.

> Uji lokal dulu. Jangan deploy ke Vercel sampai schema auth + env public sudah siap.

## Fitur

| Area | Implementasi |
| --- | --- |
| Auth | Supabase Auth — email/password + Google OAuth |
| Multi-tenant | Dokumen, chat, metrics terisolasi per `user_id` + RLS |
| Ingest | `.txt` / `.md` / `.pdf` + 10 dokumen contoh per akun |
| Retrieval | Mode **vector / BM25 / hybrid** (0.55 + 0.45) |
| Generation | Groq streaming + sitasi |
| Experiments | `/experiments` bandingkan 3 mode + export JSON/CSV |
| Eval | `/eval` golden Recall@K / Precision@K |
| Metrics | `/metrics` latency retrieve/generate + export CSV |
| Chat history | Sidebar riwayat percakapan per user |

## Setup lokal

### 1. Install & env

```bash
cd lumen
npm install
cp .env.example .env.local
```

Isi `.env.local`:

- `GROQ_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL` (+ `SUPABASE_URL` sama)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Settings → API → anon/public)
- `SUPABASE_SERVICE_ROLE_KEY` (hanya untuk script seed/admin)
- `NEXT_PUBLIC_SITE_URL=http://localhost:3000`

### 2. Schema Supabase

Di **SQL Editor**:

- Project baru → jalankan [`supabase/schema.sql`](supabase/schema.sql)
- Project lama (tabel shared) → jalankan [`supabase/schema-auth.sql`](supabase/schema-auth.sql)  
  **Warning:** migrasi ini drop tabel lama.

### 3. Auth providers

Supabase Dashboard → **Authentication**:

1. **Email** provider: ON  
   Untuk uji cepat: Authentication → Providers → Email → matikan “Confirm email” (opsional di local).
2. **Google** provider: ON + Client ID/Secret dari Google Cloud Console.
3. **Redirect URLs** tambahkan:
   - `http://localhost:3000/auth/callback`

### 4. Jalankan

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) → **Masuk / Daftar**.

Halaman terproteksi:

- Desk: `/desk`
- Experiments: `/experiments`
- Eval: `/eval`
- Metrics: `/metrics`

### 5. Seed (opsional)

Setelah register, salin User UID dari Auth → Users, lalu:

```bash
# PowerShell
$env:SEED_USER_ID="your-user-uuid"
npm run seed:supabase
```

Atau di Desk → **Muat contoh**.

## Cara uji multi-user

1. Daftar user A → muat contoh / upload dokumen A  
2. Logout → daftar user B → pastikan pustaka kosong / beda  
3. Chat di A → cek muncul di Riwayat + `/metrics`  
4. `/experiments` → bandingkan 3 mode + export CSV  
5. Login Google (jika provider sudah di-set)

## Arsitektur ringkas

```
Login (Supabase Auth cookie)
  → API (JWT user) + RLS
  → lumen_documents / lumen_chunks (per user_id)
  → retrieve(mode) → Groq stream
  → lumen_messages + lumen_query_logs
```

Fallback tanpa DB write path yang gagal: file store di `data/users/{userId}/` (local only).

## Endpoint utama

- `POST /api/chat` — stream NDJSON + simpan history/log
- `GET/POST /api/conversations`
- `GET /api/conversations/:id/messages`
- `POST /api/experiments/retrieve`
- `GET /api/metrics`
- `GET /api/eval?k=4&mode=hybrid`

## Catatan skripsi

- Isolasi data = batasan multi-tenant yang bisa dibahas di metodologi
- Experiments = bahan perbandingan metode retrieval
- Metrics CSV = data kuantitatif bab hasil
- Eval golden = validasi retrieval (bukan jawaban LLM)

## Scripts

```bash
npm run dev
npm run seed          # seed file lokal legacy
npm run seed:supabase # butuh SEED_USER_ID
npm run build
```
