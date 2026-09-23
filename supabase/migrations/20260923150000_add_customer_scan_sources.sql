alter table public.customer_automation_settings
  add column if not exists active_job_id uuid references public.analysis_jobs(id) on delete set null;

create index if not exists customer_automation_active_job_idx
  on public.customer_automation_settings (active_job_id)
  where active_job_id is not null;

create table if not exists public.customer_scan_sources (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  source_path text not null,
  file_name text not null,
  content_type text not null default 'text/csv',
  size_bytes bigint not null check (size_bytes >= 0),
  industry text,
  mapping_overrides jsonb not null default '{}'::jsonb,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_customer_scan_source_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customer_scan_source_set_updated_at
  on public.customer_scan_sources;

create trigger customer_scan_source_set_updated_at
before update on public.customer_scan_sources
for each row
execute function public.set_customer_scan_source_updated_at();

alter table public.customer_scan_sources enable row level security;

drop policy if exists "Users can read own scan source"
  on public.customer_scan_sources;

create policy "Users can read own scan source"
on public.customer_scan_sources
for select
to authenticated
using (
  exists (
    select 1
    from public.businesses b
    where b.id = customer_scan_sources.business_id
      and b.user_id = auth.uid()
  )
);

drop policy if exists "Users can create own scan source"
  on public.customer_scan_sources;

create policy "Users can create own scan source"
on public.customer_scan_sources
for insert
to authenticated
with check (
  exists (
    select 1
    from public.businesses b
    where b.id = customer_scan_sources.business_id
      and b.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own scan source"
  on public.customer_scan_sources;

create policy "Users can update own scan source"
on public.customer_scan_sources
for update
to authenticated
using (
  exists (
    select 1
    from public.businesses b
    where b.id = customer_scan_sources.business_id
      and b.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.businesses b
    where b.id = customer_scan_sources.business_id
      and b.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own scan source"
  on public.customer_scan_sources;

create policy "Users can delete own scan source"
on public.customer_scan_sources
for delete
to authenticated
using (
  exists (
    select 1
    from public.businesses b
    where b.id = customer_scan_sources.business_id
      and b.user_id = auth.uid()
  )
);

grant select, insert, update, delete
  on table public.customer_scan_sources
  to authenticated;

grant all
  on table public.customer_scan_sources
  to service_role;

notify pgrst, 'reload schema';
