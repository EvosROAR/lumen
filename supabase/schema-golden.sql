-- Add per-user golden evaluation cases
-- Run in Supabase SQL Editor after schema.sql

create table if not exists lumen_golden_cases (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  question text not null,
  expected_filenames jsonb not null default '[]'::jsonb,
  expected_answer_hint text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists lumen_golden_cases_user_id_idx
  on lumen_golden_cases (user_id, created_at desc);

alter table lumen_golden_cases enable row level security;

drop policy if exists lumen_golden_cases_select_own on lumen_golden_cases;
drop policy if exists lumen_golden_cases_insert_own on lumen_golden_cases;
drop policy if exists lumen_golden_cases_update_own on lumen_golden_cases;
drop policy if exists lumen_golden_cases_delete_own on lumen_golden_cases;

create policy lumen_golden_cases_select_own on lumen_golden_cases
  for select using (auth.uid() = user_id);
create policy lumen_golden_cases_insert_own on lumen_golden_cases
  for insert with check (auth.uid() = user_id);
create policy lumen_golden_cases_update_own on lumen_golden_cases
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy lumen_golden_cases_delete_own on lumen_golden_cases
  for delete using (auth.uid() = user_id);
