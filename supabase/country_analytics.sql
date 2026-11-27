-- Khashabita: aggregate visits by country (stores no IP addresses)
-- Run this once in the Supabase SQL Editor.

create table if not exists public.khashabita_country_visits (
  country_code text primary key check (country_code ~ '^[A-Z]{2}$'),
  country_name text not null,
  visits bigint not null default 0 check (visits >= 0),
  updated_at timestamptz not null default now()
);

alter table public.khashabita_country_visits enable row level security;

revoke all on table public.khashabita_country_visits from anon, authenticated;

create or replace function public.record_country_visit(
  p_country_code text,
  p_country_name text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_country_code, '')));
  v_name text := left(trim(coalesce(p_country_name, '')), 100);
  v_visits bigint;
begin
  if v_code !~ '^[A-Z]{2}$' or v_name = '' then
    raise exception 'Invalid country details';
  end if;

  insert into public.khashabita_country_visits (country_code, country_name, visits, updated_at)
  values (v_code, v_name, 1, now())
  on conflict (country_code) do update
    set country_name = excluded.country_name,
        visits = public.khashabita_country_visits.visits + 1,
        updated_at = now()
  returning visits into v_visits;

  return v_visits;
end;
$$;

create or replace function public.get_country_visit_stats()
returns table (
  country_code text,
  country_name text,
  visits bigint,
  share numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with totals as (
    select coalesce(sum(visits), 0)::numeric as total_visits
    from public.khashabita_country_visits
  )
  select
    c.country_code,
    c.country_name,
    c.visits,
    case
      when totals.total_visits > 0
        then round(c.visits::numeric * 100 / totals.total_visits, 1)
      else 0
    end as share
  from public.khashabita_country_visits c
  cross join totals
  order by c.visits desc, c.country_name asc;
$$;

revoke all on function public.record_country_visit(text, text) from public;
revoke all on function public.record_country_visit(text, text) from anon, authenticated;
grant execute on function public.record_country_visit(text, text) to anon, authenticated;

revoke all on function public.get_country_visit_stats() from public;
revoke all on function public.get_country_visit_stats() from anon, authenticated;
grant execute on function public.get_country_visit_stats() to anon, authenticated;

notify pgrst, 'reload schema';
