-- Denaturalization Defense Clearinghouse — initial schema
--
-- Two tables hold form submissions. Row-Level Security is ENABLED with NO
-- public policies, so neither anonymous nor logged-in end users can read or
-- write these tables directly. Only the Edge Function (which uses the service
-- role key, and therefore bypasses RLS) can insert rows. Clearinghouse staff
-- read submissions in the Supabase dashboard (Table Editor), which is gated by
-- your Supabase project login.
--
-- Data is encrypted at rest by Supabase. See SETUP.md.

-- ---------------------------------------------------------------------------
-- Citizen intake submissions
-- ---------------------------------------------------------------------------
create table if not exists public.citizen_intakes (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),

  -- contact / identity
  full_name           text not null,
  email               text not null,
  phone               text not null,
  location            text not null,
  preferred_language  text,
  contact_method      text check (contact_method in ('email','phone','either')),

  -- case status
  case_status         text not null check (case_status in ('threat','sued')),

  -- threat branch
  threat_date         date,
  threat_how          text,
  threat_how_other    text,
  threat_desc         text,

  -- lawsuit branch
  district            text,
  case_number         text,
  filed_date          date,
  served_date         date,

  -- closing
  other_info          text,
  ack_disclaimer      boolean not null default false,
  ack_consent         boolean not null default false,

  -- internal workflow (staff-managed in the dashboard)
  status              text not null default 'new'
                        check (status in ('new','reviewing','matched','closed'))
);

comment on table public.citizen_intakes is
  'Sensitive: names + contact + denaturalization case data. Need-to-know access only.';

create index if not exists citizen_intakes_created_at_idx
  on public.citizen_intakes (created_at desc);
create index if not exists citizen_intakes_status_idx
  on public.citizen_intakes (status);

-- ---------------------------------------------------------------------------
-- Lawyer volunteer sign-ups
-- ---------------------------------------------------------------------------
create table if not exists public.lawyer_signups (
  id                          uuid primary key default gen_random_uuid(),
  created_at                  timestamptz not null default now(),

  name                        text not null,
  firm                        text,
  email                       text not null,
  phone                       text not null,
  bar_admissions              text not null,
  federal_districts           text not null,
  experience                  text not null
                                check (experience in ('experienced','trained','assist')),
  denaturalization_description text,
  willing_training            boolean not null default false,
  malpractice_insurance       text check (malpractice_insurance in ('yes','no')),
  capacity                    text check (capacity in ('1','2','3+','depends')),
  venue_limitations           text,
  languages                   text,
  ack                         boolean not null default false,

  status                      text not null default 'new'
                                check (status in ('new','reviewing','active','inactive'))
);

comment on table public.lawyer_signups is
  'Volunteer lawyer contact + practice details. Need-to-know access only.';

create index if not exists lawyer_signups_created_at_idx
  on public.lawyer_signups (created_at desc);

-- ---------------------------------------------------------------------------
-- Row-Level Security: on, and locked down. Only the service role (Edge
-- Function) can touch these tables. No anon/authenticated policies are
-- defined, so PostgREST denies all direct client access by default.
-- ---------------------------------------------------------------------------
alter table public.citizen_intakes enable row level security;
alter table public.lawyer_signups  enable row level security;

-- If you later build a staff dashboard using Supabase Auth, add a SELECT
-- policy scoped to your staff (do NOT open this to public sign-ups), e.g.:
--
--   create policy "staff can read intakes"
--     on public.citizen_intakes for select
--     to authenticated
--     using ( auth.jwt() ->> 'email' in ('steve@example.org') );
--
-- Left commented out intentionally for v1.
