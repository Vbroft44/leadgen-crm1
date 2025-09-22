
-- Leads
create table if not exists leads (
  id bigserial primary key,
  customer_name text not null,
  phone text not null,
  email text,
  address text,
  service_needed text not null,
  status text not null default 'new',
  appointment_date date,
  appointment_time text,
  technician text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Activities (calls, sms, notes, etc)
create table if not exists activities (
  id bigserial primary key,
  lead_id bigint references leads(id) on delete set null,
  kind text not null, -- e.g., sms.received, call.ended, note
  phone text,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- Technicians
create table if not exists technicians (
  id bigserial primary key,
  name text not null,
  trade text not null
);

-- Lead assignments (many-to-many if you want)
create table if not exists lead_technicians (
  lead_id bigint references leads(id) on delete cascade,
  technician_id bigint references technicians(id) on delete cascade,
  primary key (lead_id, technician_id)
);

-- updated_at trigger
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

drop trigger if exists leads_set_updated_at on leads;
create trigger leads_set_updated_at before update on leads
for each row execute procedure set_updated_at();

-- RLS
alter table leads enable row level security;
alter table activities enable row level security;
alter table technicians enable row level security;
alter table lead_technicians enable row level security;

-- Allow authenticated users basic access (simple team-wide access)
drop policy if exists "leads_read" on leads;
create policy "leads_read" on leads for select using ( auth.role() = 'authenticated' );
drop policy if exists "leads_write" on leads;
create policy "leads_write" on leads for insert with check ( auth.role() = 'authenticated' );
drop policy if exists "leads_update" on leads;
create policy "leads_update" on leads for update using ( auth.role() = 'authenticated' );

drop policy if exists "activities_rw" on activities;
create policy "activities_rw" on activities for select using ( auth.role() = 'authenticated' );
create policy "activities_write" on activities for insert with check ( auth.role() = 'authenticated' );

drop policy if exists "tech_read" on technicians;
create policy "tech_read" on technicians for select using ( true );
create policy "tech_write" on technicians for insert with check ( auth.role() = 'authenticated' );

drop policy if exists "lt_rw" on lead_technicians;
create policy "lt_rw" on lead_technicians for select using ( auth.role() = 'authenticated' );
create policy "lt_write" on lead_technicians for insert with check ( auth.role() = 'authenticated' );
