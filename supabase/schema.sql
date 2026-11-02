-- Run this in the Supabase SQL Editor before inviting cashiers.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

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

create or replace function public.create_profile_for_invited_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      new.email
    )
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.create_profile_for_invited_user();

-- Backfill accounts that were invited before this schema was installed.
insert into public.profiles (id, email, display_name)
select
  id,
  email,
  coalesce(nullif(raw_user_meta_data ->> 'full_name', ''), nullif(raw_user_meta_data ->> 'name', ''), email)
from auth.users
where email is not null
on conflict (id) do update set email = excluded.email;

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
create policy "Signed-in team can read profiles"
  on public.profiles for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "Signed-in team can read sales summaries" on public.sales_summaries;
create policy "Signed-in team can read sales summaries"
  on public.sales_summaries for select to authenticated
  using (auth.uid() is not null);

drop policy if exists "Signed-in team can insert sales summaries" on public.sales_summaries;
create policy "Signed-in team can insert sales summaries"
  on public.sales_summaries for insert to authenticated
  with check (auth.uid() = recorded_by);

drop policy if exists "Signed-in team can update sales summaries" on public.sales_summaries;
create policy "Signed-in team can update sales summaries"
  on public.sales_summaries for update to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

grant select on public.profiles to authenticated;
grant select, insert, update on public.sales_summaries to authenticated;
