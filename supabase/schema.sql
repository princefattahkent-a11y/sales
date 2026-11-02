-- Apply this in the Supabase SQL Editor. Safe to rerun after the original
-- Sunday sales schema has already been installed.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists role text not null default 'cashier',
  add column if not exists approval_status text not null default 'pending',
  add column if not exists email_confirmed_at timestamptz,
  add column if not exists requested_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_check' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'cashier'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_approval_status_check' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_approval_status_check check (approval_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

create table if not exists public.sales_summaries (
  sunday_date date primary key,
  ids_printed integer not null default 0 check (ids_printed >= 0),
  mtn_amount numeric(14, 0) not null default 0 check (mtn_amount >= 0),
  airtel_amount numeric(14, 0) not null default 0 check (airtel_amount >= 0),
  expenses numeric(14, 0) not null default 0 check (expenses >= 0),
  cash_deposited numeric(14, 0) not null default 0 check (cash_deposited >= 0),
  recorded_by uuid not null constraint sales_summaries_recorded_by_fkey references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_summaries_sunday_only check (extract(isodow from sunday_date) = 7)
);

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text;
begin
  if new.email is null then
    return new;
  end if;

  profile_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    new.email
  );

  insert into public.profiles (id, email, display_name, email_confirmed_at, requested_at)
  values (
    new.id,
    new.email,
    profile_name,
    new.email_confirmed_at,
    case when new.email_confirmed_at is not null then now() else null end
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    email_confirmed_at = excluded.email_confirmed_at,
    requested_at = coalesce(public.profiles.requested_at, excluded.requested_at);
  return new;
end;
$$;

create or replace function public.sync_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = new.email,
      display_name = coalesce(
        nullif(new.raw_user_meta_data ->> 'full_name', ''),
        nullif(new.raw_user_meta_data ->> 'name', ''),
        new.email
      ),
      email_confirmed_at = new.email_confirmed_at,
      requested_at = case
        when new.email_confirmed_at is not null then coalesce(requested_at, now())
        else requested_at
      end
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
drop trigger if exists on_auth_user_updated_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.create_profile_for_auth_user();
create trigger on_auth_user_updated_profile
  after update on auth.users
  for each row execute procedure public.sync_profile_for_auth_user();

-- Existing and previously invited users must also wait for approval.
insert into public.profiles (id, email, display_name, email_confirmed_at, requested_at)
select
  id,
  email,
  coalesce(nullif(raw_user_meta_data ->> 'full_name', ''), nullif(raw_user_meta_data ->> 'name', ''), email),
  email_confirmed_at,
  case when email_confirmed_at is not null then now() else null end
from auth.users
where email is not null
on conflict (id) do update set
  email = excluded.email,
  display_name = excluded.display_name,
  email_confirmed_at = excluded.email_confirmed_at,
  requested_at = coalesce(public.profiles.requested_at, excluded.requested_at);

create or replace function public.is_approved_team_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and approval_status = 'approved'
  );
$$;

create or replace function public.is_team_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and approval_status = 'approved'
  );
$$;

create or replace function public.review_cashier_request(target_user_id uuid, decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_team_admin() then
    raise exception 'Only an approved admin can review signup requests.' using errcode = '42501';
  end if;
  if decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected.' using errcode = '22023';
  end if;

  update public.profiles
  set approval_status = decision
  where id = target_user_id
    and role = 'cashier'
    and approval_status = 'pending'
    and email_confirmed_at is not null;

  if not found then
    raise exception 'This confirmed signup request is no longer pending.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.is_approved_team_member() from public, anon;
revoke all on function public.is_team_admin() from public, anon;
revoke all on function public.review_cashier_request(uuid, text) from public, anon;
grant execute on function public.is_approved_team_member() to authenticated;
grant execute on function public.is_team_admin() to authenticated;
grant execute on function public.review_cashier_request(uuid, text) to authenticated;

create or replace function public.preserve_sales_recorder()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.recorded_by := old.recorded_by;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists preserve_sales_recorder_on_update on public.sales_summaries;
create trigger preserve_sales_recorder_on_update
  before update on public.sales_summaries
  for each row execute procedure public.preserve_sales_recorder();

alter table public.profiles enable row level security;
alter table public.sales_summaries enable row level security;

drop policy if exists "Signed-in team can read profiles" on public.profiles;
drop policy if exists "profiles_self_read" on public.profiles;
drop policy if exists "profiles_admin_read" on public.profiles;
drop policy if exists "profiles_approved_team_read" on public.profiles;
create policy "profiles_self_read"
  on public.profiles for select to authenticated
  using (auth.uid() = id);
create policy "profiles_admin_read"
  on public.profiles for select to authenticated
  using (public.is_team_admin());
create policy "profiles_approved_team_read"
  on public.profiles for select to authenticated
  using (public.is_approved_team_member() and approval_status = 'approved');

drop policy if exists "Signed-in team can read sales summaries" on public.sales_summaries;
drop policy if exists "Signed-in team can insert sales summaries" on public.sales_summaries;
drop policy if exists "Signed-in team can update sales summaries" on public.sales_summaries;
drop policy if exists "approved_team_read_sales" on public.sales_summaries;
drop policy if exists "approved_team_insert_sales" on public.sales_summaries;
drop policy if exists "approved_team_update_sales" on public.sales_summaries;
create policy "approved_team_read_sales"
  on public.sales_summaries for select to authenticated
  using (public.is_approved_team_member());
create policy "approved_team_insert_sales"
  on public.sales_summaries for insert to authenticated
  with check (public.is_approved_team_member() and auth.uid() = recorded_by);
create policy "approved_team_update_sales"
  on public.sales_summaries for update to authenticated
  using (public.is_approved_team_member())
  with check (public.is_approved_team_member());

grant select on public.profiles to authenticated;
grant select, insert, update on public.sales_summaries to authenticated;
