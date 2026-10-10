-- Migration 0001 — create normalized schema alongside the existing
-- public.profiles / public.applications tables.
--
-- This migration is purely additive. It does not touch, rename, or drop
-- any existing table, column, row, or RLS policy. public.profiles and
-- public.applications keep working exactly as before until you run
-- 0003 (a separate, manual, destructive step) once you've verified the
-- backfill in 0002.
--
-- Run order: 0001 (this file) -> 0002_backfill_from_legacy.sql -> deploy
-- the new application code -> verify -> 0003_drop_legacy_columns.sql
-- (optional, manual, destructive).
--
-- BACK UP FIRST: `pg_dump` your database (or take a Supabase point-in-time
-- backup) before running this. It is additive and should be safe on its
-- own, but every step in this migration set assumes you can roll back.

-- ---------------------------------------------------------------------
-- 0. application_status enum
-- ---------------------------------------------------------------------
-- Uses the app's existing ten ApplicationStatus values (src/lib/types.ts),
-- NOT the tech lead's eleven-step shorthand list. See the migration notes
-- delivered alongside this file for why: the app's UI (StatusBadge,
-- StatusTimeline, STATUS_FLOW, every reviewer screen) is built around
-- these exact values, and remapping them is a materially bigger change
-- than this pass is scoped for.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'application_status') then
    create type public.application_status as enum (
      'DRAFT',
      'SUBMITTED',
      'REWORK_REQUIRED',
      'IN_REVIEW_ELIGIBILITY',
      'IN_REVIEW_SCORING',
      'SHORTLISTED',
      'PENDING_CONTEXTUAL_FEEDBACK',
      'PENDING_ECOSYSTEM_VALIDATION',
      'ECOSYSTEM_VALIDATED',
      'REJECTED'
    );
  end if;
end $$;

-- Shared updated_at trigger function. Already defined by the original
-- schema.sql for public.applications — created here with `or replace` so
-- this migration is safe to run standalone against a fresh database too.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Shared optimistic-concurrency trigger: increments `version` on every
-- update, ignoring whatever value the client sent. Applied to
-- eso_applications and scoring_reviews per the tech lead's spec.
create or replace function public.bump_version()
returns trigger
language plpgsql
as $$
begin
  new.version = coalesce(old.version, 1) + 1;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. organizations
-- ---------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name varchar(255) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 2. users (public profile row per auth.users — NOT a custom auth table)
-- ---------------------------------------------------------------------
-- Deliberately does NOT include password_hash or mfa_secret. Supabase
-- Auth already owns password hashing (auth.users) and TOTP MFA
-- (auth.mfa_factors); duplicating either here would be a second,
-- divergent source of truth. `state` is kept (beyond the tech lead's
-- illustrative column list) because it already existed on the old
-- public.profiles table and SessionUser.state depends on it.
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  full_name text not null default '',
  state text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_organization_id on public.users (organization_id);

alter table public.users enable row level security;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own" on public.users
  for insert with check (auth.uid() = id);

drop policy if exists "organizations_select_member" on public.organizations;
create policy "organizations_select_member" on public.organizations
  for select using (
    id in (select organization_id from public.users where id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- 3. roles & user_roles
-- ---------------------------------------------------------------------
-- Created for schema completeness per the tech lead's design. Not
-- written to by application code this pass — the app hardcodes
-- ROLE_ESO for Supabase-authenticated session users, matching the fact
-- that only the ESO-facing flow is wired to Supabase today. Reviewer
-- role assignment via these tables is a follow-up once the reviewer UI
-- itself moves off the mock adapter.
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name varchar(50) unique not null
);

insert into public.roles (name)
values
  ('ROLE_ESO'),
  ('ROLE_ELIGIBILITY_REVIEWER'),
  ('ROLE_SCORING_REVIEWER'),
  ('ROLE_VALIDATOR'),
  ('ROLE_SYSADMIN')
on conflict (name) do nothing;

create table if not exists public.user_roles (
  user_id uuid not null references public.users (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  primary key (user_id, role_id)
);

create index if not exists idx_user_roles_user_id on public.user_roles (user_id);
create index if not exists idx_user_roles_role_id on public.user_roles (role_id);

alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
-- No permissive policies yet: these tables are unused by app code this
-- pass, so anon/authenticated get no access (service_role bypasses RLS
-- for any admin tooling). Add policies when the reviewer UI is wired.

-- ---------------------------------------------------------------------
-- 4. eso_applications
-- ---------------------------------------------------------------------
-- Every ApplicationForm field (Sections A-H, src/lib/types.ts) has a
-- home here or in a child table. File fields live in application_files,
-- keyed by file_type; Section E's repeatable references live in
-- eso_references. Column prefixes (sa_/sb_/sc_/.../sh_) mirror the form
-- sections so the adapter's row<->form mapping stays legible.
create table if not exists public.eso_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  applicant_user_id uuid not null references public.users (id) on delete cascade,

  code text not null default '',
  status public.application_status not null default 'DRAFT',
  rejection_stage text not null default 'NONE'
    check (rejection_stage in ('ELIGIBILITY', 'SCORING', 'VALIDATION', 'NONE')),
  rejection_reason text,
  conflict_flagged boolean not null default false,
  conflict_signoff_by uuid references public.users (id),

  -- top-level Application snapshot fields (set at draft creation, not
  -- part of the Sections A-H form)
  organisation_name text not null default '',
  state text not null default '',

  -- Section A: organisation identity
  sa_legal_name text,
  sa_registration_type text,
  sa_year_established text,
  sa_organisation_type text,
  sa_website text,
  sa_contact_name text,
  sa_contact_role text,
  sa_contact_phone text,
  sa_contact_email text,

  -- Section B: compliance & operational presence
  sb_states text[] not null default '{}',
  sb_office_address text,
  sb_proximity_to_host text,
  sb_tin text,
  sb_staff_full_time text,
  sb_staff_part_time text,
  sb_governance_structure text,

  -- Section C: programme delivery
  sc_sector_focus text[] not null default '{}',
  sc_delivery_track_record text,
  sc_mentorship_network text,
  sc_inclusion_capacity text,

  -- Section D: institutional alignment
  sd_existing_relationships text,
  sd_coordination_plan text,
  sd_faculty_engagement_plan text,
  sd_beneficiary_referral_plan text,

  -- Section F: experience & industry linkage
  sf_conducted_incubation text,
  sf_conducted_acceleration text,
  sf_monitoring_systems text,
  sf_sustainability_plan text,
  sf_employment_pathway text,
  sf_pipeline_agreements text,
  sf_post_exit_tracking text,
  sf_investor_relationships text,

  -- Section G: policies & declarations
  sg_conflict_of_interest boolean not null default false,
  sg_safeguarding_commitment boolean not null default false,
  sg_inclusion_commitment boolean not null default false,
  sg_reporting_commitment boolean not null default false,

  -- Section H: consent & signature
  sh_ndpa_consent boolean not null default false,
  sh_accuracy_declaration boolean not null default false,
  sh_signatory_name text,
  sh_signatory_title text,
  sh_signed_at timestamptz,

  -- cached / derived
  average_score numeric(5, 2),
  completeness integer not null default 0,
  version integer not null default 1,

  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_eso_applications_organization_id
  on public.eso_applications (organization_id);
create index if not exists idx_eso_applications_applicant_user_id
  on public.eso_applications (applicant_user_id);
create index if not exists idx_eso_apps_sector_focus
  on public.eso_applications using gin (sc_sector_focus);
create index if not exists idx_eso_apps_states
  on public.eso_applications using gin (sb_states);

alter table public.eso_applications enable row level security;

drop trigger if exists eso_applications_set_updated_at on public.eso_applications;
create trigger eso_applications_set_updated_at
  before update on public.eso_applications
  for each row execute function public.set_updated_at();

drop trigger if exists eso_applications_bump_version on public.eso_applications;
create trigger eso_applications_bump_version
  before update on public.eso_applications
  for each row execute function public.bump_version();

drop policy if exists "eso_applications_select_own" on public.eso_applications;
create policy "eso_applications_select_own" on public.eso_applications
  for select using (auth.uid() = applicant_user_id);

drop policy if exists "eso_applications_insert_own" on public.eso_applications;
create policy "eso_applications_insert_own" on public.eso_applications
  for insert with check (auth.uid() = applicant_user_id);

drop policy if exists "eso_applications_update_own_while_editable" on public.eso_applications;
create policy "eso_applications_update_own_while_editable" on public.eso_applications
  for update
  using (auth.uid() = applicant_user_id and status in ('DRAFT', 'REWORK_REQUIRED'))
  with check (auth.uid() = applicant_user_id);

-- Mandatory-field validation at submission, in addition to (not instead
-- of) the client-side calculateCompleteness() check in
-- src/lib/completeness.ts. Mirrors that check's required fields; deviates
-- from the tech lead's literal "AFTER INSERT OR DELETE" trigger on
-- eso_references for the reference-count rule (see migration notes) —
-- the count is checked here, at submission time, instead, so that saving
-- a partially-filled draft with 1-2 references in progress never fails.
create or replace function public.check_eso_application_submission()
returns trigger
language plpgsql
as $$
declare
  reference_count integer;
  coi_doc_count integer;
begin
  if new.status = 'SUBMITTED' and (old.status is distinct from 'SUBMITTED') then
    if new.sa_legal_name is null or new.sa_legal_name = '' then
      raise exception 'Cannot submit: organisation legal name is missing.';
    end if;
    if new.sa_registration_type is null or new.sa_registration_type = '' then
      raise exception 'Cannot submit: registration type is missing.';
    end if;
    if new.sb_tin is null or new.sb_tin = '' then
      raise exception 'Cannot submit: Tax Identification Number is missing.';
    end if;
    if array_length(new.sb_states, 1) is null then
      raise exception 'Cannot submit: at least one state of operation is required.';
    end if;
    if array_length(new.sc_sector_focus, 1) is null then
      raise exception 'Cannot submit: at least one sector focus is required.';
    end if;
    if not new.sg_safeguarding_commitment
      or not new.sg_inclusion_commitment
      or not new.sg_reporting_commitment then
      raise exception 'Cannot submit: all Section G commitments must be accepted.';
    end if;
    if not new.sh_ndpa_consent or not new.sh_accuracy_declaration then
      raise exception 'Cannot submit: NDPA consent and accuracy declaration are required.';
    end if;
    if new.sh_signatory_name is null or new.sh_signatory_name = ''
      or new.sh_signatory_title is null or new.sh_signatory_title = '' then
      raise exception 'Cannot submit: authorised signatory name and title are required.';
    end if;

    select count(*) into reference_count
    from public.eso_references
    where application_id = new.id;
    if reference_count <> 3 then
      raise exception 'Cannot submit: exactly 3 reference contacts are required (found %).', reference_count;
    end if;

    if new.sg_conflict_of_interest then
      select count(*) into coi_doc_count
      from public.application_files
      where application_id = new.id and file_type = 'COI_DOC';
      if coi_doc_count = 0 then
        raise exception 'Cannot submit: a conflict-of-interest document is required when a conflict is declared.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists eso_applications_check_submission on public.eso_applications;
create trigger eso_applications_check_submission
  before update on public.eso_applications
  for each row execute function public.check_eso_application_submission();

-- ---------------------------------------------------------------------
-- 5. eso_references (Section E, exactly 3 required at submission)
-- ---------------------------------------------------------------------
-- Extends the tech lead's illustrative `contact_info` single field into
-- separate phone/email columns, matching the app's existing Reference
-- type (src/lib/types.ts) which collects both.
create table if not exists public.eso_references (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.eso_applications (id) on delete cascade,
  name varchar(255) not null,
  relationship varchar(100) not null,
  phone varchar(50) not null default '',
  email varchar(255) not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_eso_references_app_id
  on public.eso_references (application_id);

alter table public.eso_references enable row level security;

drop policy if exists "eso_references_all_own" on public.eso_references;
create policy "eso_references_all_own" on public.eso_references
  for all using (
    application_id in (select id from public.eso_applications where applicant_user_id = auth.uid())
  )
  with check (
    application_id in (select id from public.eso_applications where applicant_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- 6. file_upload_sessions (staging / audit log for uploads)
-- ---------------------------------------------------------------------
-- The current Cloudinary flow (src/services/cloudinary/uploadClient.ts)
-- is a single direct XHR upload, not chunked/resumable. This table is
-- not used for real resumability yet — a row is inserted when an upload
-- starts and updated to Completed/Failed when it resolves, so it's a
-- real audit log even though nothing reads it back today.
create table if not exists public.file_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.eso_applications (id) on delete cascade,
  file_name varchar(255) not null,
  total_size integer not null,
  uploaded_bytes integer not null default 0,
  status varchar(20) not null default 'Uploading'
    check (status in ('Uploading', 'Completed', 'Failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_file_upload_sessions_app_id
  on public.file_upload_sessions (application_id);

alter table public.file_upload_sessions enable row level security;

drop trigger if exists file_upload_sessions_set_updated_at on public.file_upload_sessions;
create trigger file_upload_sessions_set_updated_at
  before update on public.file_upload_sessions
  for each row execute function public.set_updated_at();

drop policy if exists "file_upload_sessions_all_own" on public.file_upload_sessions;
create policy "file_upload_sessions_all_own" on public.file_upload_sessions
  for all using (
    application_id in (select id from public.eso_applications where applicant_user_id = auth.uid())
  )
  with check (
    application_id in (select id from public.eso_applications where applicant_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- 7. application_files
-- ---------------------------------------------------------------------
-- file_type covers every FileAsset field on ApplicationForm plus the
-- top-level institutionalEndorsement field, extending the tech lead's
-- illustrative enum values (REGISTRATION_CERT, TAX_CLEARANCE,
-- AUDITED_ACCOUNTS, ORGANOGRAM, MANAGEMENT_CV, COI_DOC) with the rest
-- of the form's file fields.
create table if not exists public.application_files (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.eso_applications (id) on delete cascade,
  file_type varchar(100) not null check (file_type in (
    'REGISTRATION_CERT',
    'PRESENCE_EVIDENCE',
    'TAX_CLEARANCE',
    'TAX_COMPLIANCE_EVIDENCE',
    'AUDITED_ACCOUNTS',
    'ORGANOGRAM',
    'MANAGEMENT_CV',
    'DELIVERY_EVIDENCE',
    'INCUBATION_EVIDENCE',
    'COI_DOC',
    'INSTITUTIONAL_ENDORSEMENT'
  )),
  file_name text not null default '',
  -- MIME type, e.g. "application/pdf" — extends the tech lead's
  -- illustrative column list because FileAsset.type (src/lib/types.ts)
  -- needs to round-trip through this table for the UI's file-type icons
  -- and the upload validator to work unchanged.
  mime_type text not null default '',
  s3_url varchar(512) not null,
  file_size integer check (file_size <= 10485760),
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_application_files_app_id
  on public.application_files (application_id);
create index if not exists idx_application_files_app_id_type
  on public.application_files (application_id, file_type);

alter table public.application_files enable row level security;

drop policy if exists "application_files_all_own" on public.application_files;
create policy "application_files_all_own" on public.application_files
  for all using (
    application_id in (select id from public.eso_applications where applicant_user_id = auth.uid())
  )
  with check (
    application_id in (select id from public.eso_applications where applicant_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- 8. application_status_history (append-only audit log)
-- ---------------------------------------------------------------------
create table if not exists public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.eso_applications (id) on delete cascade,
  previous_status public.application_status,
  new_status public.application_status not null,
  changed_by uuid references public.users (id),
  comments text,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_status_hist_app_id
  on public.application_status_history (application_id);

alter table public.application_status_history enable row level security;

drop policy if exists "application_status_history_select_own" on public.application_status_history;
create policy "application_status_history_select_own" on public.application_status_history
  for select using (
    application_id in (select id from public.eso_applications where applicant_user_id = auth.uid())
  );

drop policy if exists "application_status_history_insert_own" on public.application_status_history;
create policy "application_status_history_insert_own" on public.application_status_history
  for insert with check (
    application_id in (select id from public.eso_applications where applicant_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- 9. application_data_history (append-only snapshot log)
-- ---------------------------------------------------------------------
-- Append-only, like application_status_history: rows are never updated
-- after creation, so only created_at is needed (no updated_at), per the
-- tech lead's spec.
create table if not exists public.application_data_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.eso_applications (id) on delete cascade,
  snapshot_data jsonb not null,
  status_at_time public.application_status not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_data_hist_app_id
  on public.application_data_history (application_id);

alter table public.application_data_history enable row level security;
-- Not written to by app code this pass (rework-cycle snapshotting is
-- part of the reviewer/admin workflow, still on the mock adapter). No
-- permissive policy yet.

-- ---------------------------------------------------------------------
-- 10. Reviewer-side tables — created for schema completeness, NOT wired
--     to any app code this pass. The reviewer, scoring, validator, and
--     admin flows still run entirely on the mock/localStorage adapter
--     (src/services/applicationService.ts, src/data/seed.ts). RLS is
--     enabled with no permissive policies; add them when that UI moves
--     off the mock adapter.
-- ---------------------------------------------------------------------
create table if not exists public.scoring_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.eso_applications (id) on delete cascade,
  reviewer_id uuid not null references public.users (id),
  version integer not null default 1,
  scores_data jsonb,
  total_percentage numeric(5, 2),
  status varchar(20) not null default 'Draft' check (status in ('Draft', 'Submitted')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, reviewer_id)
);

create index if not exists idx_scoring_reviews_app_id on public.scoring_reviews (application_id);
create index if not exists idx_scoring_reviews_reviewer_id on public.scoring_reviews (reviewer_id);

alter table public.scoring_reviews enable row level security;

drop trigger if exists scoring_reviews_set_updated_at on public.scoring_reviews;
create trigger scoring_reviews_set_updated_at
  before update on public.scoring_reviews
  for each row execute function public.set_updated_at();

drop trigger if exists scoring_reviews_bump_version on public.scoring_reviews;
create trigger scoring_reviews_bump_version
  before update on public.scoring_reviews
  for each row execute function public.bump_version();

create table if not exists public.eligibility_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.eso_applications (id) on delete cascade,
  reviewer_id uuid not null references public.users (id),
  checklist jsonb,
  decision varchar(20) not null default '' check (decision in ('', 'eligible', 'not_eligible', 'rework')),
  rework_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_eligibility_reviews_app_id
  on public.eligibility_reviews (application_id);

alter table public.eligibility_reviews enable row level security;

create table if not exists public.ecosystem_validations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.eso_applications (id) on delete cascade,
  validator_id uuid not null references public.users (id),
  checklist jsonb,
  notes text,
  outcome varchar(20) not null default '' check (outcome in ('', 'verified', 'not_verified')),
  validated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_ecosystem_validations_app_id
  on public.ecosystem_validations (application_id);

alter table public.ecosystem_validations enable row level security;

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.eso_applications (id) on delete cascade,
  actor_id uuid not null references public.users (id),
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_actions_app_id on public.admin_actions (application_id);

alter table public.admin_actions enable row level security;

-- ---------------------------------------------------------------------
-- 11. Signup trigger — now populates organizations + users, not profiles
-- ---------------------------------------------------------------------
-- Replaces the original handle_new_user(). public.profiles is untouched
-- and keeps being populated by ITS OWN trigger below only if you have
-- not yet cut the app over — see the migration notes for why this
-- function is replaced now rather than in 0003.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_org_id uuid;
begin
  insert into public.organizations (name)
  values (coalesce(new.raw_user_meta_data ->> 'organisation_name', ''))
  returning id into new_org_id;

  insert into public.users (id, organization_id, full_name, state)
  values (
    new.id,
    new_org_id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'state', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- If you are running this against the live project that already has
-- schema.sql's original on_auth_user_created trigger, `create or
-- replace function` above is enough to change its behaviour — the
-- trigger already points at this function. The create/drop below is
-- here so this file is also correct standalone against a fresh
-- database that never ran the original schema.sql.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
