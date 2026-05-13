-- reactimate Supabase schema
--
-- Paste this into your Supabase project → SQL Editor → New query and run it
-- once. It creates the tables and RLS policies needed for:
--   * `/feedback`  — signed-in users submit feedback and read their threads
--   * `/admin`     — admins view all profiles, all feedback, and reply
--
-- After running this, mark yourself as admin:
--   update public.profiles set is_admin = true where email = 'you@example.com';
--
-- Idempotent: safe to re-run (uses IF NOT EXISTS / OR REPLACE).

-- =============================================================================
-- profiles: one row per auth user, populated by trigger on sign-up
-- =============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for any existing auth.users rows
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

drop policy if exists "users update own last_seen" on public.profiles;
create policy "users update own last_seen"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- =============================================================================
-- feedback: user-submitted messages to the admin
-- =============================================================================
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  subject text not null,
  body text not null,
  status text not null default 'open' check (status in ('open', 'replied', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feedback_user_id_idx on public.feedback(user_id);
create index if not exists feedback_created_at_idx on public.feedback(created_at desc);

alter table public.feedback enable row level security;

drop policy if exists "authenticated insert own feedback" on public.feedback;
create policy "authenticated insert own feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);

drop policy if exists "users read own feedback" on public.feedback;
create policy "users read own feedback"
  on public.feedback for select
  using (auth.uid() = user_id);

drop policy if exists "admins read all feedback" on public.feedback;
create policy "admins read all feedback"
  on public.feedback for select
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

drop policy if exists "admins update feedback" on public.feedback;
create policy "admins update feedback"
  on public.feedback for update
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- =============================================================================
-- feedback_replies: admin replies to a feedback thread
-- =============================================================================
create table if not exists public.feedback_replies (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists feedback_replies_feedback_id_idx on public.feedback_replies(feedback_id);

alter table public.feedback_replies enable row level security;

drop policy if exists "users read replies to own feedback" on public.feedback_replies;
create policy "users read replies to own feedback"
  on public.feedback_replies for select
  using (
    exists (
      select 1 from public.feedback f
      where f.id = feedback_id and f.user_id = auth.uid()
    )
  );

drop policy if exists "admins read all feedback replies" on public.feedback_replies;
create policy "admins read all feedback replies"
  on public.feedback_replies for select
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

drop policy if exists "admins insert feedback replies" on public.feedback_replies;
create policy "admins insert feedback replies"
  on public.feedback_replies for insert
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- =============================================================================
-- Optional: expose reply-count + last reply via a view (admin-only)
-- =============================================================================
create or replace view public.feedback_with_counts as
select
  f.*,
  (select count(*) from public.feedback_replies r where r.feedback_id = f.id) as reply_count,
  (select max(r.created_at) from public.feedback_replies r where r.feedback_id = f.id) as last_reply_at
from public.feedback f;

-- =============================================================================
-- presets: saved effect presets (per-user). The frontend's PresetStorage
-- interface routes through here when the user is signed in; falls back to
-- localStorage otherwise.
-- =============================================================================
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
