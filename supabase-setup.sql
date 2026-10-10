-- Readiness Tracker: safe per-user cloud storage setup
-- Run this in Supabase Dashboard -> SQL Editor -> New query.
-- This does NOT disable RLS and does NOT grant access to other users.

create table if not exists public.readiness_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.readiness_data
  add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.readiness_data
  add column if not exists schema_version integer not null default 1;
alter table public.readiness_data
  add column if not exists updated_at timestamptz not null default now();

alter table public.readiness_data enable row level security;

drop policy if exists "Users can read their own readiness data" on public.readiness_data;
create policy "Users can read their own readiness data"
  on public.readiness_data for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own readiness data" on public.readiness_data;
create policy "Users can insert their own readiness data"
  on public.readiness_data for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own readiness data" on public.readiness_data;
create policy "Users can update their own readiness data"
  on public.readiness_data for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_readiness_data_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists readiness_data_set_updated_at on public.readiness_data;
create trigger readiness_data_set_updated_at
  before update on public.readiness_data
  for each row execute function public.set_readiness_data_updated_at();

grant select, insert, update on public.readiness_data to authenticated;
