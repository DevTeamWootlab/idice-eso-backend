-- Migration 0003 — OPTIONAL, MANUAL, DESTRUCTIVE.
--
-- Do NOT run this until ALL of the following are true:
--   1. 0001 and 0002 have run successfully against production.
--   2. The verification queries at the end of 0002 show matching row
--      counts and no unexpected gaps.
--   3. The new application code (applicationAdapter.ts / authAdapter.ts
--      reading from organizations/users/eso_applications/...) is
--      deployed and you have personally confirmed, against the live
--      Supabase project, that: registering a new ESO account works,
--      an existing applicant's saved application loads with the right
--      values in every section, saving the form persists correctly,
--      and submitting a complete application succeeds.
--   4. You have a fresh backup taken AFTER step 3's confirmation (not
--      just the pre-migration one from step 0001).
--
-- This is a hard boundary deliberately: nothing in 0001 or 0002 deletes
-- data, so you can re-run or roll back either of them freely. This file
-- is the only irreversible step, so it is separated out and must be run
-- by you, manually, not as part of an automated migration pipeline,
-- once you are certain the cutover worked.

drop table if exists public.applications cascade;
drop table if exists public.profiles cascade;

-- The original handle_new_user() trigger function was already replaced
-- in 0001 to populate organizations/users instead of profiles, so
-- nothing further is needed there.
