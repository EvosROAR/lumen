-- Lumen knowledge store on Supabase (Postgres)
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run

create table if not exists lumen_documents (
  id text primary key,
  title text not null,
  filename text not null,
  chars integer not null,
  chunks integer not null,
  created_at timestamptz not null default now()
);

create table if not exists lumen_chunks (
  id text primary key,
  document_id text not null references lumen_documents(id) on delete cascade,
  title text not null,
  filename text not null,
  chunk_index integer not null,
  content text not null,
  embedding jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists lumen_chunks_document_id_idx
  on lumen_chunks (document_id);

-- Optional: allow service role full access (default for service key)
-- Keep RLS off for server-side service role usage, or enable with policies later.
alter table lumen_documents enable row level security;
alter table lumen_chunks enable row level security;

-- No anon policies on purpose: only service role (server) reads/writes.
-- If you prefer open demo writes from anon key, add policies carefully.
