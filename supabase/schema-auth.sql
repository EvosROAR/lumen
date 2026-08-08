-- Lumen multi-user schema (Auth + RLS)
-- Supabase Dashboard → SQL Editor → paste seluruh file → Run
--
-- WARNING: destructive. Drop tabel Lumen lama (shared store tanpa user_id),
-- lalu recreate. Data dokumen lama akan hilang — setelah login, pakai
-- "Muat contoh" di Desk atau npm run seed:supabase.

drop table if exists lumen_query_logs cascade;
drop table if exists lumen_messages cascade;
drop table if exists lumen_conversations cascade;
drop table if exists lumen_chunks cascade;
drop table if exists lumen_documents cascade;

create table lumen_documents (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  filename text not null,
  chars integer not null,
  chunks integer not null,
  created_at timestamptz not null default now()
);

create table lumen_chunks (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id text not null references lumen_documents (id) on delete cascade,
  title text not null,
  filename text not null,
  chunk_index integer not null,
  content text not null,
  embedding jsonb not null,
  created_at timestamptz not null default now()
);

create table lumen_conversations (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Percakapan baru',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lumen_messages (
  id text primary key,
  conversation_id text not null references lumen_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  citations jsonb,
  created_at timestamptz not null default now()
);

create table lumen_query_logs (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id text references lumen_conversations (id) on delete set null,
  query text not null,
  retrieval_mode text not null default 'hybrid',
  retrieve_ms integer not null default 0,
  generate_ms integer not null default 0,
  total_ms integer not null default 0,
  top_k integer not null default 4,
  citation_count integer not null default 0,
  citation_filenames jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table lumen_golden_cases (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  question text not null,
  expected_filenames jsonb not null default '[]'::jsonb,
  expected_answer_hint text not null default '',
  created_at timestamptz not null default now()
);

create index lumen_documents_user_id_idx on lumen_documents (user_id);
create index lumen_chunks_user_document_idx on lumen_chunks (user_id, document_id);
create index lumen_conversations_user_id_idx on lumen_conversations (user_id, updated_at desc);
create index lumen_messages_conversation_idx on lumen_messages (conversation_id, created_at);
create index lumen_query_logs_user_id_idx on lumen_query_logs (user_id, created_at desc);
create index lumen_golden_cases_user_id_idx on lumen_golden_cases (user_id, created_at desc);

alter table lumen_documents enable row level security;
alter table lumen_chunks enable row level security;
alter table lumen_conversations enable row level security;
alter table lumen_messages enable row level security;
alter table lumen_query_logs enable row level security;
alter table lumen_golden_cases enable row level security;

create policy lumen_documents_select_own on lumen_documents
  for select using (auth.uid() = user_id);
create policy lumen_documents_insert_own on lumen_documents
  for insert with check (auth.uid() = user_id);
create policy lumen_documents_update_own on lumen_documents
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy lumen_documents_delete_own on lumen_documents
  for delete using (auth.uid() = user_id);

create policy lumen_chunks_select_own on lumen_chunks
  for select using (auth.uid() = user_id);
create policy lumen_chunks_insert_own on lumen_chunks
  for insert with check (auth.uid() = user_id);
create policy lumen_chunks_update_own on lumen_chunks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy lumen_chunks_delete_own on lumen_chunks
  for delete using (auth.uid() = user_id);

create policy lumen_conversations_select_own on lumen_conversations
  for select using (auth.uid() = user_id);
create policy lumen_conversations_insert_own on lumen_conversations
  for insert with check (auth.uid() = user_id);
create policy lumen_conversations_update_own on lumen_conversations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy lumen_conversations_delete_own on lumen_conversations
  for delete using (auth.uid() = user_id);

create policy lumen_messages_select_own on lumen_messages
  for select using (auth.uid() = user_id);
create policy lumen_messages_insert_own on lumen_messages
  for insert with check (auth.uid() = user_id);
create policy lumen_messages_update_own on lumen_messages
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy lumen_messages_delete_own on lumen_messages
  for delete using (auth.uid() = user_id);

create policy lumen_query_logs_select_own on lumen_query_logs
  for select using (auth.uid() = user_id);
create policy lumen_query_logs_insert_own on lumen_query_logs
  for insert with check (auth.uid() = user_id);
create policy lumen_query_logs_delete_own on lumen_query_logs
  for delete using (auth.uid() = user_id);

create policy lumen_golden_cases_select_own on lumen_golden_cases
  for select using (auth.uid() = user_id);
create policy lumen_golden_cases_insert_own on lumen_golden_cases
  for insert with check (auth.uid() = user_id);
create policy lumen_golden_cases_update_own on lumen_golden_cases
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy lumen_golden_cases_delete_own on lumen_golden_cases
  for delete using (auth.uid() = user_id);
