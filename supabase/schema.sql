-- Readiness cloud persistence foundation
-- Run in Supabase SQL Editor before enabling cloud sync.
-- One row per authenticated account; RLS limits access to its owner.

create table if not exists public.readiness_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint readiness_data_data_object check (jsonb_typeof(data) = 'object')
);

alter table public.readiness_data enable row level security;
revoke all on table public.readiness_data from anon;
grant select, insert, update, delete on table public.readiness_data to authenticated;

drop policy if exists "Read own readiness data" on public.readiness_data;
create policy "Read own readiness data" on public.readiness_data
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Insert own readiness data" on public.readiness_data;
create policy "Insert own readiness data" on public.readiness_data
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Update own readiness data" on public.readiness_data;
create policy "Update own readiness data" on public.readiness_data
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Delete own readiness data" on public.readiness_data;
create policy "Delete own readiness data" on public.readiness_data
for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.readiness_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists readiness_data_updated_at on public.readiness_data;
create trigger readiness_data_updated_at before update on public.readiness_data
for each row execute function public.readiness_set_updated_at();
