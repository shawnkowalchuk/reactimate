-- Adds `public.presets` for cloud-stored effect presets.
-- Idempotent — safe to paste into the Supabase SQL Editor and run.
-- Also already included in supabase/schema.sql; this file exists so you
-- don't have to re-run the whole schema if you've already done that.

create table if not exists public.presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  effect_type text not null,
  config jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists presets_user_id_idx on public.presets(user_id);
create index if not exists presets_created_at_idx on public.presets(created_at);

alter table public.presets enable row level security;

drop policy if exists "users read own presets" on public.presets;
create policy "users read own presets"
  on public.presets for select
  using (auth.uid() = user_id);

drop policy if exists "users insert own presets" on public.presets;
create policy "users insert own presets"
  on public.presets for insert
  with check (auth.uid() = user_id);

drop policy if exists "users update own presets" on public.presets;
create policy "users update own presets"
  on public.presets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users delete own presets" on public.presets;
create policy "users delete own presets"
  on public.presets for delete
  using (auth.uid() = user_id);
