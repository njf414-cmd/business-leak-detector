-- Customer automation foundation for Business Leak Detector.
-- Milestone 11A: customer onboarding + automation preferences.

create table if not exists public.customer_automation_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,

  setup_mode text not null default 'manual'
    check (setup_mode in ('manual', 'ai', 'done_for_you')),

  onboarding_status text not null default 'not_started'
    check (onboarding_status in ('not_started', 'in_progress', 'ready', 'paused')),

  data_status text not null default 'not_connected'
    check (data_status in ('not_connected', 'needs_mapping', 'ready', 'error')),

  recurring_scans_enabled boolean not null default false,

  report_frequency text not null default 'manual'
    check (report_frequency in ('manual', 'weekly', 'biweekly', 'monthly')),

  notifications_enabled boolean not null default true,
  notification_email text,

  timezone text not null default 'America/New_York',

  next_scan_at timestamptz,
  last_scan_at timestamptz,
  onboarding_completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_automation_next_scan_idx
  on public.customer_automation_settings (next_scan_at)
  where recurring_scans_enabled = true
    and onboarding_status = 'ready'
    and data_status = 'ready';

create or replace function public.set_customer_automation_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customer_automation_set_updated_at
  on public.customer_automation_settings;

create trigger customer_automation_set_updated_at
before update on public.customer_automation_settings
for each row
execute function public.set_customer_automation_updated_at();

alter table public.customer_automation_settings enable row level security;

drop policy if exists "Users can read own automation settings"
  on public.customer_automation_settings;

create policy "Users can read own automation settings"
on public.customer_automation_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.businesses b
    where b.id = customer_automation_settings.business_id
      and b.user_id = auth.uid()
  )
);

drop policy if exists "Users can create own automation settings"
  on public.customer_automation_settings;

create policy "Users can create own automation settings"
on public.customer_automation_settings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.businesses b
    where b.id = customer_automation_settings.business_id
      and b.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own automation settings"
  on public.customer_automation_settings;

create policy "Users can update own automation settings"
on public.customer_automation_settings
for update
to authenticated
using (
  exists (
    select 1
    from public.businesses b
    where b.id = customer_automation_settings.business_id
      and b.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.businesses b
    where b.id = customer_automation_settings.business_id
      and b.user_id = auth.uid()
  )
);

grant select, insert, update
  on table public.customer_automation_settings
  to authenticated;

grant all
  on table public.customer_automation_settings
  to service_role;

insert into public.customer_automation_settings (business_id)
select id
from public.businesses
on conflict (business_id) do nothing;
