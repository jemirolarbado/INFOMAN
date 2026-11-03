-- Supabase database setup for the Hope, Inc. ERP website

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  role text not null default 'user'
    constraint profiles_role_check check (role in ('user', 'admin', 'superadmin')),
  status text not null default 'active'
    constraint profiles_status_check check (status in ('active', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.module_access (
  user_id uuid not null references public.profiles(id) on delete cascade,
  module text not null,
  primary key (user_id, module),
  constraint module_access_module_check check (module in ('hr', 'reports'))
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.handle_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1))
    ),
    new.email
  )
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Create profiles for users that already existed before this trigger was installed.
insert into public.profiles (id, full_name, email)
select
  users.id,
  coalesce(
    nullif(trim(users.raw_user_meta_data ->> 'full_name'), ''),
    coalesce(users.raw_user_meta_data ->> 'name', split_part(coalesce(users.email, ''), '@', 1))
  ),
  users.email
from auth.users users
on conflict (id) do nothing;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = auth.uid();
$$;

alter table public.profiles enable row level security;
alter table public.module_access enable row level security;

drop policy if exists "Users can view their profile" on public.profiles;
create policy "Users can view their profile"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.current_user_role() in ('admin', 'superadmin'));

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
on public.profiles for update
to authenticated
using (
  id = auth.uid()
  or public.current_user_role() in ('admin', 'superadmin')
)
with check (
  id = auth.uid()
  or public.current_user_role() in ('admin', 'superadmin')
);

drop policy if exists "Administrators can insert profiles" on public.profiles;
create policy "Administrators can insert profiles"
on public.profiles for insert
to authenticated
with check (public.current_user_role() in ('admin', 'superadmin'));

drop policy if exists "Users can view their module access" on public.module_access;
create policy "Users can view their module access"
on public.module_access for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_user_role() in ('admin', 'superadmin')
);

drop policy if exists "Administrators can manage module access" on public.module_access;
create policy "Administrators can manage module access"
on public.module_access for all
to authenticated
using (public.current_user_role() in ('admin', 'superadmin'))
with check (public.current_user_role() in ('admin', 'superadmin'));

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, delete, update on public.module_access to authenticated;
