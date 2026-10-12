-- Readiness admin dashboard
-- Run this file in Supabase SQL Editor only after supabase/schema.sql exists.
-- The dashboard uses a server-side authorization check; hiding admin.html is NOT security.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
revoke all on table public.admin_users from anon, authenticated;

create or replace function public.admin_list_users()
returns table (
  user_id uuid,
  email text,
  data jsonb,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
  ) then
    raise exception 'Akses admin ditolak' using errcode = '42501';
  end if;

  return query
    select rd.user_id, u.email::text, rd.data, rd.updated_at
    from public.readiness_data rd
    left join auth.users u on u.id = rd.user_id
    order by rd.updated_at desc;
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- After running this SQL, add the intended administrator by UUID:
-- insert into public.admin_users (user_id) values ('PASTE_AUTH_USER_UUID_HERE');
-- Get the UUID from Supabase Dashboard > Authentication > Users.
-- Do not grant admin access by email supplied from the browser.
