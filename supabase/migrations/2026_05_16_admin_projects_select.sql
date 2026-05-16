-- Lets admins read every row in public.projects for the admin dashboard's
-- stats (total cloud projects, active editors, effect-type usage, etc.).
-- Idempotent — safe to paste into the Supabase SQL Editor and re-run.
--
-- Also mirrored into supabase/schema.sql so a fresh schema apply picks it
-- up too. Non-admin rows already have read access via "users select own
-- project"; this adds a parallel admin policy that grants SELECT to any
-- profile flagged is_admin = true.

drop policy if exists "admins read all projects" on public.projects;
create policy "admins read all projects"
  on public.projects for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );
