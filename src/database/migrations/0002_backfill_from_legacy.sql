-- Migration 0002 — backfill public.organizations / public.users /
-- public.eso_applications / public.eso_references / public.application_files
-- from the existing public.profiles and public.applications tables.
--
-- Run this AFTER 0001 and BEFORE deploying the new application code (the
-- new applicationAdapter.ts reads from the normalized tables only, so
-- until this has run there is nothing there for it to read).
--
-- Idempotent: every insert is guarded so re-running this script is safe
-- and will not create duplicates. It preserves the original
-- profiles.id / applications.id values as the new users.id /
-- eso_applications.id, so foreign keys and any external references
-- (e.g. a support ticket that quotes an application id) stay valid.
--
-- BACK UP FIRST if you have not already (pg_dump or a Supabase
-- point-in-time backup). This script only INSERTs — it does not
-- update or delete anything in profiles or applications — but back up
-- before any migration step regardless.

-- ---------------------------------------------------------------------
-- 1. Backfill organizations + users from profiles
-- ---------------------------------------------------------------------
do $$
declare
  p record;
  new_org_id uuid;
begin
  for p in
    select * from public.profiles
    where id not in (select id from public.users)
  loop
    insert into public.organizations (name, created_at, updated_at)
    values (p.organisation_name, p.created_at, p.created_at)
    returning id into new_org_id;

    insert into public.users (id, organization_id, full_name, state, created_at, updated_at)
    values (p.id, new_org_id, p.full_name, p.state, p.created_at, p.created_at);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. Backfill eso_applications + eso_references + application_files
--    from applications.form / applications.institutional_endorsement
-- ---------------------------------------------------------------------
do $$
declare
  a record;
  ref jsonb;
  cv jsonb;
  f jsonb;
begin
  for a in
    select * from public.applications
    where id not in (select id from public.eso_applications)
  loop
    insert into public.eso_applications (
      id, organization_id, applicant_user_id, code, status,
      organisation_name, state,
      sa_legal_name, sa_registration_type, sa_year_established, sa_organisation_type,
      sa_website, sa_contact_name, sa_contact_role, sa_contact_phone, sa_contact_email,
      sb_states, sb_office_address, sb_proximity_to_host, sb_tin,
      sb_staff_full_time, sb_staff_part_time, sb_governance_structure,
      sc_sector_focus, sc_delivery_track_record, sc_mentorship_network, sc_inclusion_capacity,
      sd_existing_relationships, sd_coordination_plan, sd_faculty_engagement_plan, sd_beneficiary_referral_plan,
      sf_conducted_incubation, sf_conducted_acceleration, sf_monitoring_systems, sf_sustainability_plan,
      sf_employment_pathway, sf_pipeline_agreements, sf_post_exit_tracking, sf_investor_relationships,
      sg_conflict_of_interest, sg_safeguarding_commitment, sg_inclusion_commitment, sg_reporting_commitment,
      sh_ndpa_consent, sh_accuracy_declaration, sh_signatory_name, sh_signatory_title, sh_signed_at,
      completeness, submitted_at, created_at, updated_at
    )
    values (
      a.id,
      (select organization_id from public.users where id = a.applicant_user_id),
      a.applicant_user_id, a.code, a.status::public.application_status,
      a.organisation_name, a.state,
      a.form -> 'sectionA' ->> 'legalName',
      nullif(a.form -> 'sectionA' ->> 'registrationType', ''),
      a.form -> 'sectionA' ->> 'yearEstablished',
      a.form -> 'sectionA' ->> 'organisationType',
      a.form -> 'sectionA' ->> 'website',
      a.form -> 'sectionA' ->> 'contactName',
      a.form -> 'sectionA' ->> 'contactRole',
      a.form -> 'sectionA' ->> 'contactPhone',
      a.form -> 'sectionA' ->> 'contactEmail',
      coalesce(
        (select array_agg(x) from jsonb_array_elements_text(a.form -> 'sectionB' -> 'states') as x),
        '{}'
      ),
      a.form -> 'sectionB' ->> 'officeAddress',
      nullif(a.form -> 'sectionB' ->> 'proximityToHost', ''),
      a.form -> 'sectionB' ->> 'tin',
      a.form -> 'sectionB' ->> 'staffFullTime',
      a.form -> 'sectionB' ->> 'staffPartTime',
      a.form -> 'sectionB' ->> 'governanceStructure',
      coalesce(
        (select array_agg(x) from jsonb_array_elements_text(a.form -> 'sectionC' -> 'sectorFocus') as x),
        '{}'
      ),
      a.form -> 'sectionC' ->> 'deliveryTrackRecord',
      a.form -> 'sectionC' ->> 'mentorshipNetwork',
      a.form -> 'sectionC' ->> 'inclusionCapacity',
      a.form -> 'sectionD' ->> 'existingRelationships',
      a.form -> 'sectionD' ->> 'coordinationPlan',
      a.form -> 'sectionD' ->> 'facultyEngagementPlan',
      a.form -> 'sectionD' ->> 'beneficiaryReferralPlan',
      nullif(a.form -> 'sectionF' ->> 'conductedIncubation', ''),
      nullif(a.form -> 'sectionF' ->> 'conductedAcceleration', ''),
      a.form -> 'sectionF' ->> 'monitoringSystems',
      a.form -> 'sectionF' ->> 'sustainabilityPlan',
      a.form -> 'sectionF' ->> 'employmentPathway',
      nullif(a.form -> 'sectionF' ->> 'pipelineAgreements', ''),
      a.form -> 'sectionF' ->> 'postExitTracking',
      a.form -> 'sectionF' ->> 'investorRelationships',
      coalesce((a.form -> 'sectionG' ->> 'conflictOfInterest')::boolean, false),
      coalesce((a.form -> 'sectionG' ->> 'safeguardingCommitment')::boolean, false),
      coalesce((a.form -> 'sectionG' ->> 'inclusionCommitment')::boolean, false),
      coalesce((a.form -> 'sectionG' ->> 'reportingCommitment')::boolean, false),
      coalesce((a.form -> 'sectionH' ->> 'ndpaConsent')::boolean, false),
      coalesce((a.form -> 'sectionH' ->> 'accuracyDeclaration')::boolean, false),
      a.form -> 'sectionH' ->> 'signatoryName',
      a.form -> 'sectionH' ->> 'signatoryTitle',
      nullif(a.form -> 'sectionH' ->> 'signedAt', '')::timestamptz,
      a.completeness, a.submitted_at, a.created_at, a.updated_at
    );

    -- Section E references
    if a.form -> 'sectionE' -> 'references' is not null then
      for ref in select * from jsonb_array_elements(a.form -> 'sectionE' -> 'references')
      loop
        insert into public.eso_references (application_id, name, relationship, phone, email)
        values (
          a.id,
          coalesce(ref ->> 'name', ''),
          coalesce(ref ->> 'relationship', ''),
          coalesce(ref ->> 'phone', ''),
          coalesce(ref ->> 'email', '')
        );
      end loop;
    end if;

    -- Single-file Section A/B/C/F/G fields
    for f in
      select * from jsonb_array_elements(jsonb_build_array(
        jsonb_build_object('type', 'REGISTRATION_CERT', 'file', a.form -> 'sectionA' -> 'registrationCertificate'),
        jsonb_build_object('type', 'PRESENCE_EVIDENCE', 'file', a.form -> 'sectionB' -> 'presenceEvidence'),
        jsonb_build_object('type', 'TAX_CLEARANCE', 'file', a.form -> 'sectionB' -> 'taxClearanceCertificate'),
        jsonb_build_object('type', 'TAX_COMPLIANCE_EVIDENCE', 'file', a.form -> 'sectionB' -> 'taxComplianceEvidence'),
        jsonb_build_object('type', 'AUDITED_ACCOUNTS', 'file', a.form -> 'sectionB' -> 'auditedAccounts'),
        jsonb_build_object('type', 'ORGANOGRAM', 'file', a.form -> 'sectionB' -> 'organogram'),
        jsonb_build_object('type', 'DELIVERY_EVIDENCE', 'file', a.form -> 'sectionC' -> 'deliveryEvidence'),
        jsonb_build_object('type', 'INCUBATION_EVIDENCE', 'file', a.form -> 'sectionF' -> 'incubationEvidence'),
        jsonb_build_object('type', 'COI_DOC', 'file', a.form -> 'sectionG' -> 'conflictOfInterestEvidence'),
        jsonb_build_object('type', 'INSTITUTIONAL_ENDORSEMENT', 'file', a.institutional_endorsement)
      ))
    loop
      if f -> 'file' is not null and f -> 'file' <> 'null' then
        insert into public.application_files (application_id, file_type, file_name, mime_type, s3_url, file_size, uploaded_at)
        values (
          a.id,
          f ->> 'type',
          coalesce(f -> 'file' ->> 'name', ''),
          coalesce(f -> 'file' ->> 'type', ''),
          coalesce(f -> 'file' ->> 'url', ''),
          nullif(f -> 'file' ->> 'sizeBytes', '')::integer,
          coalesce(nullif(f -> 'file' ->> 'uploadedAt', '')::timestamptz, now())
        );
      end if;
    end loop;

    -- Section B CVs (multi-file)
    if a.form -> 'sectionB' -> 'cvs' is not null then
      for cv in select * from jsonb_array_elements(a.form -> 'sectionB' -> 'cvs')
      loop
        insert into public.application_files (application_id, file_type, file_name, mime_type, s3_url, file_size, uploaded_at)
        values (
          a.id,
          'MANAGEMENT_CV',
          coalesce(cv ->> 'name', ''),
          coalesce(cv ->> 'type', ''),
          coalesce(cv ->> 'url', ''),
          nullif(cv ->> 'sizeBytes', '')::integer,
          coalesce(nullif(cv ->> 'uploadedAt', '')::timestamptz, now())
        );
      end loop;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. Verification — run these and compare before proceeding to 0003
-- ---------------------------------------------------------------------
-- Row counts must match on both sides:
select
  (select count(*) from public.profiles) as legacy_profiles,
  (select count(*) from public.users) as new_users,
  (select count(*) from public.applications) as legacy_applications,
  (select count(*) from public.eso_applications) as new_eso_applications;

-- Spot-check: every legacy application's reference count should be 0 or 3
-- (0 for very early drafts that never got to Section E).
select a.id, a.code, count(r.id) as reference_count
from public.applications a
left join public.eso_references r on r.application_id = a.id
group by a.id, a.code
having count(r.id) not in (0, 3);

-- Spot-check: total file rows created should roughly match the number of
-- non-null file fields across every legacy application's form.
select count(*) from public.application_files;
