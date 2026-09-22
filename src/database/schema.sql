drop table if exists public.admin_actions cascade;
drop table if exists public.ecosystem_validations cascade;
drop table if exists public.eligibility_reviews cascade;
drop table if exists public.scoring_reviews cascade;
drop table if exists public.application_data_history cascade;
drop table if exists public.application_status_history cascade;
drop table if exists public.application_files cascade;
drop table if exists public.file_upload_sessions cascade;
drop table if exists public.eso_references cascade;
drop table if exists public.eso_applications cascade;
drop table if exists public.user_roles cascade;
drop table if exists public.roles cascade;
drop table if exists public.users cascade;
drop table if exists public.organizations cascade;


drop table if exists public.applications cascade;
drop table if exists public.profiles cascade;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.check_eso_application_submission();
drop function if exists public.bump_version();
drop function if exists public.set_updated_at();
drop type if exists public.application_status;

-- 1. application_status enum
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

-- Shared updated_at trigger function.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


create or replace function public.bump_version()
returns trigger
language plpgsql
as $$
begin
  new.version = coalesce(old.version, 1) + 1;
  return new;
end;
$$;

-- 2. organizations
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name varchar(255) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- 3. users (public profile row per auth.users — NOT a custom auth table)

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  full_name text not null default '',
  email text not null default '',
  state text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_users_organization_id on public.users (organization_id);

alter table public.users enable row level security;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

create policy "users_update_own" on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "users_insert_own" on public.users
  for insert with check (auth.uid() = id);

create policy "organizations_select_member" on public.organizations
  for select using (
    id in (select organization_id from public.users where id = auth.uid())
  );


-- 4. roles & user_roles
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name varchar(50) unique not null
);

insert into public.roles (name)
values
  ('ROLE_ESO'),
  ('ROLE_ELIGIBILITY_REVIEWER'),
  ('ROLE_SCORING_REVIEWER'),
  ('ROLE_VALIDATOR'),
  ('ROLE_SYSADMIN');

create table public.user_roles (
  user_id uuid not null references public.users (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  primary key (user_id, role_id)
);

create index idx_user_roles_user_id on public.user_roles (user_id);
create index idx_user_roles_role_id on public.user_roles (role_id);

alter table public.roles enable row level security;
alter table public.user_roles enable row level security;

create policy "user_roles_select_own" on public.user_roles
  for select using (user_id = auth.uid());

create policy "roles_select_authenticated" on public.roles
  for select using (auth.uid() is not null);


create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name <> 'ROLE_ESO'
  );
$$;

create policy "user_roles_select_staff" on public.user_roles
  for select using (public.is_staff());

create policy "users_select_staff" on public.users
  for select using (public.is_staff());

-- 5. eso_applications

create table public.eso_applications (
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
  sh_brownfield_declaration boolean not null default false,
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

create index idx_eso_applications_organization_id
  on public.eso_applications (organization_id);
create index idx_eso_applications_applicant_user_id
  on public.eso_applications (applicant_user_id);
create index idx_eso_apps_sector_focus
  on public.eso_applications using gin (sc_sector_focus);
create index idx_eso_apps_states
  on public.eso_applications using gin (sb_states);

alter table public.eso_applications enable row level security;

create trigger eso_applications_set_updated_at
  before update on public.eso_applications
  for each row execute function public.set_updated_at();

create trigger eso_applications_bump_version
  before update on public.eso_applications
  for each row execute function public.bump_version();

create policy "eso_applications_select_own" on public.eso_applications
  for select using (auth.uid() = applicant_user_id);

create policy "eso_applications_insert_own" on public.eso_applications
  for insert with check (auth.uid() = applicant_user_id);

create policy "eso_applications_update_own_while_editable" on public.eso_applications
  for update
  using (auth.uid() = applicant_user_id and status in ('DRAFT', 'REWORK_REQUIRED'))
  with check (auth.uid() = applicant_user_id);


-- Reviewer/validator visibility is scoped to their own queue (by status),
-- not the whole application pool. ROLE_SYSADMIN keeps unrestricted access.
create or replace function public.has_role(role_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.name = role_name
  );
$$;

create policy "eso_applications_select_eligibility_reviewer" on public.eso_applications
  for select using (
    public.has_role('ROLE_ELIGIBILITY_REVIEWER')
    and status in ('SUBMITTED', 'REWORK_REQUIRED', 'IN_REVIEW_ELIGIBILITY')
  );

create policy "eso_applications_select_scoring_reviewer" on public.eso_applications
  for select using (
    public.has_role('ROLE_SCORING_REVIEWER')
    and status = 'IN_REVIEW_SCORING'
  );

create policy "eso_applications_select_validator" on public.eso_applications
  for select using (
    public.has_role('ROLE_VALIDATOR')
    and status in ('PENDING_ECOSYSTEM_VALIDATION', 'ECOSYSTEM_VALIDATED')
  );

create policy "eso_applications_select_sysadmin" on public.eso_applications
  for select using (public.has_role('ROLE_SYSADMIN'));

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
    if not new.sh_brownfield_declaration then
      raise exception 'Cannot submit: the brownfield infrastructure rehabilitation declaration must be confirmed.';
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

create trigger eso_applications_check_submission
  before update on public.eso_applications
  for each row execute function public.check_eso_application_submission();

-- 6. eso_references (Section E, exactly 3 required at submission)
create table public.eso_references (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.eso_applications (id) on delete cascade,
  name varchar(255) not null,
  relationship varchar(100) not null,
  phone varchar(50) not null default '',
  email varchar(255) not null default '',
  created_at timestamptz not null default now()
);

create index idx_eso_references_app_id
  on public.eso_references (application_id);

alter table public.eso_references enable row level security;

create policy "eso_references_all_own" on public.eso_references
  for all using (
    application_id in (select id from public.eso_applications where applicant_user_id = auth.uid())
  )
  with check (
    application_id in (select id from public.eso_applications where applicant_user_id = auth.uid())
  );

create policy "eso_references_select_staff" on public.eso_references
  for select using (public.is_staff());

-- 7. file_upload_sessions (staging / audit log for uploads)
create table public.file_upload_sessions (
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

create index idx_file_upload_sessions_app_id
  on public.file_upload_sessions (application_id);

alter table public.file_upload_sessions enable row level security;

create trigger file_upload_sessions_set_updated_at
  before update on public.file_upload_sessions
  for each row execute function public.set_updated_at();

create policy "file_upload_sessions_all_own" on public.file_upload_sessions
  for all using (
    application_id in (select id from public.eso_applications where applicant_user_id = auth.uid())
  )
  with check (
    application_id in (select id from public.eso_applications where applicant_user_id = auth.uid())
  );

-- 8. application_files
create table public.application_files (
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
  mime_type text not null default '',
  s3_url varchar(512) not null,
  file_size integer check (file_size <= 10485760),
  uploaded_at timestamptz not null default now()
);

create index idx_application_files_app_id
  on public.application_files (application_id);
create index idx_application_files_app_id_type
  on public.application_files (application_id, file_type);

alter table public.application_files enable row level security;

create policy "application_files_all_own" on public.application_files
  for all using (
    application_id in (select id from public.eso_applications where applicant_user_id = auth.uid())
  )
  with check (
    application_id in (select id from public.eso_applications where applicant_user_id = auth.uid())
  );


create policy "application_files_select_staff" on public.application_files
  for select using (public.is_staff());


-- 9. application_status_history (append-only audit log)

create table public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.eso_applications (id) on delete cascade,
  previous_status public.application_status,
  new_status public.application_status not null,
  changed_by uuid references public.users (id),
  comments text,
  created_at timestamptz not null default now()
);

create index idx_app_status_hist_app_id
  on public.application_status_history (application_id);

alter table public.application_status_history enable row level security;

create policy "application_status_history_select_own" on public.application_status_history
  for select using (
    application_id in (select id from public.eso_applications where applicant_user_id = auth.uid())
  );

create policy "application_status_history_insert_own" on public.application_status_history
  for insert with check (
    application_id in (select id from public.eso_applications where applicant_user_id = auth.uid())
  );

-- 10. application_data_history (append-only snapshot log)

create table public.application_data_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.eso_applications (id) on delete cascade,
  snapshot_data jsonb not null,
  status_at_time public.application_status not null,
  created_at timestamptz not null default now()
);

create index idx_app_data_hist_app_id
  on public.application_data_history (application_id);

alter table public.application_data_history enable row level security;


-- 11. Reviewer-side tables — created for schema completeness, NOT wired

create table public.scoring_reviews (
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

create index idx_scoring_reviews_app_id on public.scoring_reviews (application_id);
create index idx_scoring_reviews_reviewer_id on public.scoring_reviews (reviewer_id);

alter table public.scoring_reviews enable row level security;

create trigger scoring_reviews_set_updated_at
  before update on public.scoring_reviews
  for each row execute function public.set_updated_at();

create trigger scoring_reviews_bump_version
  before update on public.scoring_reviews
  for each row execute function public.bump_version();

create table public.eligibility_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.eso_applications (id) on delete cascade,
  reviewer_id uuid not null references public.users (id),
  checklist jsonb,
  decision varchar(20) not null default '' check (decision in ('', 'eligible', 'not_eligible', 'rework')),
  rework_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_eligibility_reviews_app_id
  on public.eligibility_reviews (application_id);

alter table public.eligibility_reviews enable row level security;

create table public.ecosystem_validations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.eso_applications (id) on delete cascade,
  validator_id uuid not null references public.users (id),
  checklist jsonb,
  notes text,
  outcome varchar(20) not null default '' check (outcome in ('', 'verified', 'not_verified')),
  validated_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_ecosystem_validations_app_id
  on public.ecosystem_validations (application_id);

alter table public.ecosystem_validations enable row level security;

create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.eso_applications (id) on delete cascade,
  actor_id uuid not null references public.users (id),
  action text not null,
  created_at timestamptz not null default now()
);

create index idx_admin_actions_app_id on public.admin_actions (application_id);

alter table public.admin_actions enable row level security;

-- 12. Signup trigger — populates organizations + users on every new

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

  insert into public.users (id, organization_id, full_name, state, email)
  values (
    new.id,
    new_org_id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'state', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();