# Corrections round 4 — release notes

## Deploy checklist (in this order)

1. **Run the migrations** — `yarn db:migrate:prod`. Two files: `1789820000000-InAppNotifications` (creates the
   `in_app_notifications` table) and `1789830000000-CorrectionsRound4` (adds `users.scoringSlot`,
   `beneficiaries.academicStatus`, `beneficiaries.allocatedAt`). Both idempotent. **See DEPLOYMENT-RUNBOOK.md for the full,
   ordered procedure.**
2. **Set reviewer slots** — Users & Roles → *Edit* each existing Scoring Reviewer → choose Reviewer 1 or Reviewer 2.
   Until then, assigning reviewers to an application is refused ("has no reviewer slot"). If more than two Scoring
   Reviewers are currently active, suspend the extras first — the new cap of two applies to edits too.
3. **Deploy backend and portal together.** The portal now calls endpoints an older backend does not have.
4. **Prove the deployed API matches this code** —
   `API_URL=https://<api>/api/v1 ACCESS_TOKEN=<SYSADMIN token> yarn check:deployed-routes`.
   Red banners such as "That couldn't be found" or "Validation failed (uuid is expected)" mean the running API is
   older than the portal (or a proxy is answering instead). The script prints status *and* body for each missing route
   so the two cases can be told apart.
5. **Load the course catalogue** — `yarn db:seed:prod` (the Training page cannot create cohorts without courses).
6. **Demo pacing** — sign-in and 2FA verification are limited to 5 attempts per minute per IP. Signing into several
   accounts from one network in quick succession will hit "Too many attempts"; leave about a minute between batches.

## What changed

| Corrections item | Change |
|---|---|
| Document-speak | Section letters, C1/C2 headings, "Section 1.1", the eligibility "cognitive bias masking" paragraph, the yarn/seed message and the "wired up… until that work ships" card removed from the UI. Steps are numbered, one title per step. |
| Homepage button | "Apply as a beneficiary" uses the shared button styles (`LinkButton`). |
| Hub selection | One *Preferred Centre of Excellence* field; hub type and courses follow from it. "Your selected Centre of Excellence runs a …" is shown as plain text. |
| Youth form | Delivery mode, second "training hub" and "Training track" removed; academic / employment status is compulsory (form and API); Appendix A curriculum shown inline as expandable panels; the demo auto-fill is gone. |
| Scoring reviewers | Exactly two active (Reviewer 1 / Reviewer 2), enforced on invite, bulk CSV, edit, reactivation and assignment. |
| Validators | State required at invite, in bulk CSV and on edit. **Fixed:** the validator queue compared state case-sensitively, so a validator provisioned as `KWARA` saw an empty queue for institutions stored as `Kwara`. |
| RBAC | Reviewers and validators see only their own queue (menu and direct URL). |
| Notifications | Bell notified on queue entry (new submission, ready for scoring, validator escalation, shortlist, ready for matching) and when the other scoring reviewer submits. Refreshes every 10 s and on tab focus. |
| User management | Edit (name, role, state, slot), resend invite (1/min), guards for self-role-change and last administrator. Role changes and suspensions take effect immediately. |
| PCU dashboard | Filters (state, centre, cohort, period, NUC/NBTE), per-centre drill-down, CSV / Excel / PDF for PCU, NUC and NBTE. Offline mode counts real records instead of the hard-coded figures. |
| Match engine | Two steps: *propose* (`POST /internal/match-engine/run`) then *approve* (`POST /internal/match-engine/commit`, moves applications to MATCHED, emails the ESO). Index is calculated from reviewer scores and sector focus; no randomness. |
| Weights total 100% | Already enforced (save disabled off-100 and rejected by the API). |

## Decisions worth knowing

- **NUC / NBTE** is judged from the institution's name (polytechnics → NBTE, universities → NUC, anything else appears
  only in the PCU report). There is no regulator column yet.
- **Period filter**: enrolment counts by allocation date, completions and placements by their own dates.
- **Deleting a user** is not offered (accounts are suspended, not removed).

## Two-factor sign-in: "Invalid or expired MFA code" for every code

The server returns that message only when both the authenticator code and the backup-code check fail. Causes
fixed in this release:

- **Enrolment re-issued a new secret on every visit** to the setup page (refresh, second sign-in), leaving stale
  entries in the authenticator app that no longer matched. An unconfirmed secret is now reused.
- **Backup codes stored in a text column could never match** (read back as a string, iterated character by
  character). They are now read defensively, and the migration converts the column to jsonb.
- **Strict clock window** — a code from the adjacent 30-second step is now accepted.
- The server now logs *why* a check failed (no secret on file / no code matched, with the number of backup codes on
  file — never the codes themselves).
- **New: Users & Roles → Reset 2FA** (`POST /internal/users/:id/reset-mfa`, audit-logged) removes someone's secret and
  backup codes so they enrol again at the next sign-in.

### Unlocking an account right now (before the UI is deployed, or if the only administrator is locked out)

Check what state the account is in:

```sql
SELECT u.email, u."mfaEnabled", (m.id IS NOT NULL) AS has_secret,
       pg_typeof(m."backupCodes") AS backup_column_type
FROM users u LEFT JOIN mfa_secrets m ON m."userId" = u.id
WHERE u.email = 'admin@idice.eso.wootlab.ng';
```

Then reset it (the person is asked to enrol again at next sign-in; **delete every old entry for this account in the
authenticator app first**, then scan the new QR code once):

```sql
DELETE FROM mfa_secrets WHERE "userId" = (SELECT id FROM users WHERE email = 'admin@idice.eso.wootlab.ng');
UPDATE users SET "mfaEnabled" = false WHERE email = 'admin@idice.eso.wootlab.ng';
```
