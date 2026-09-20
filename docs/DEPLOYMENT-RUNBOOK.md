# iDICE ESO — deployment runbook (corrections rounds 3–4)

Follow this top to bottom on **staging first**. The order matters: the application code now reads database
columns that only exist after the migrations have run, so deploying code without migrating takes **sign-in down**
(HTTP 500 on `POST /auth/login`).

## 0. Applying the backend zip safely (read before you replace anything)

The zip contains the **code only**, inside one folder named `idice-eso-backend-files/` (the same layout as the zip you
sent me). Do **not** delete your project folder and drop the zip in its place. Extract the zip and **copy everything inside
that folder over your project, overwriting files**, so that these are left untouched:

| Keep | Why |
|---|---|
| `.env` / any environment files | database and secret settings are not in the zip |
| `.git` | your history |
| `node_modules`, `dist` | rebuilt by `yarn install` / `yarn build` |
| **`src/database/migrations/*` — every migration your team already has** | the zip only adds two new migration files; deleting yours would break your schema history |

If you already generated your own migration for `users.scoringSlot`, `beneficiaries.academicStatus` /
`allocatedAt`, or the `in_app_notifications` table, delete **yours** (the two included migrations cover them and are safe
to re-run) — otherwise the later of the two will fail with "column/relation already exists".

**`tsconfig.json` changed by one word:** `"types": ["node", "multer"]` is now `["node", "multer", "jest"]`. Without `jest`
there, your editor cannot see `describe` / `it` / `expect`, so every `*.spec.ts` file shows errors (and `yarn test`
fails to compile them). If you keep your own `tsconfig.json`, make that one edit. The spec files are unit tests that are
excluded from the production build; they are safe to delete but worth keeping.

After copying: `yarn install`, then `yarn build`. A clean build is the compile check; if it reports errors, send me the
first few lines.

## 1. What must be in place

| Item | Where | Notes |
|---|---|---|
| Backend code | `idice-eso-backend-files.zip` | replaces `src/`, `scripts/`, `docs/`, `package.json` |
| Portal code | `idice-eso-portal-files.zip` | replaces `src/` |
| Migration 1 | `src/database/migrations/1789820000000-InAppNotifications.ts` | creates the `in_app_notifications` table (the notification bell) |
| Migration 2 | `src/database/migrations/1789830000000-CorrectionsRound4.ts` | 3 new columns + backup-code column fix |

Both migrations are idempotent (`IF NOT EXISTS`), so they are safe even if you already created some of this by hand
or generated your own migration. They run in timestamp order: `…820…` then `…830…`.

**Earlier versions of Migration 2 were broken** (they referenced `"createdAt"`; the real column is `created_at`, so the
whole migration rolled back and login returned 500). Make sure you use the corrected file.

## 2. Before you start

1. **Back up the database** — `pg_dump -Fc "$DB_NAME" > idice-before-round4.dump`.
2. **Check environment variables** (backend):
   - `DB_HOST DB_PORT DB_NAME DB_USERNAME DB_PASSWORD`
   - `JWT_ACCESS_SECRET JWT_REFRESH_SECRET`
   - `MFA_ENCRYPTION_KEY` (64 hex chars) and `MFA_ISSUER` — **never change the encryption key** once anyone has enrolled 2FA:
     every stored authenticator secret becomes undecryptable. `NIN_ENCRYPTION_KEY` / `NIN_HASH_KEY` likewise.
   - `CORS_ORIGINS` must include the portal origin (e.g. `https://staging.idice.eso.wootlab.ng`).
   - `FRONTEND_URL` = the portal URL (used in the links inside invitation and verification emails).
   - `SYSADMIN_SEED_EMAIL`, `SYSADMIN_SEED_PASSWORD` (only used the first time; the seed skips an existing admin).
3. **Portal environment** (values are baked in at build time — change them, then rebuild):
   `NEXT_PUBLIC_DATA_SOURCE=api`, `NEXT_PUBLIC_API_BASE_URL=https://<api-host>/api/v1`, `NEXT_PUBLIC_API_HEALTH_URL`.

## 3. Deploy and migrate (in this order)

```bash
# --- backend ---
yarn install
yarn build                      # compiles src/ -> dist/ (the migrations are run from dist/)
ls dist/database/migrations     # must list BOTH migration files; if not, the build did not pick them up
yarn db:migration:show:prod     # optional: shows the two as pending ([ ] = not yet run)
yarn db:migrate:prod            # runs 1789820000000 then 1789830000000
yarn db:seed:prod               # course catalogue + admin (safe to re-run)
# restart the API process (pm2 / docker / your host)

# --- portal ---
yarn install && yarn build      # then restart / redeploy the portal
```

`yarn deploy:prod` is the same as `db:migrate:prod` followed by `db:seed:prod`.

If `db:migrate:prod` says **"No migrations are pending"** although you have not run them: `dist/` is stale — rebuild.
If it fails, **read the error, do not retry blindly** — a failed migration rolls back completely and is not recorded, so
it can be re-run after the cause is fixed. Send me the error text.

## 4. Verify the database

```sql
SELECT item, present FROM (VALUES
  ('table in_app_notifications', to_regclass('public.in_app_notifications') IS NOT NULL),
  ('users.scoringSlot',          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users'         AND column_name='scoringSlot')),
  ('beneficiaries.academicStatus', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='beneficiaries' AND column_name='academicStatus')),
  ('beneficiaries.allocatedAt',  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='beneficiaries' AND column_name='allocatedAt')),
  ('mfa_secrets.backupCodes is jsonb', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mfa_secrets' AND column_name='backupCodes' AND data_type='jsonb'))
) AS t(item, present);
```

Every row must say `true` (the last row only matters if 2FA has been used). Also: `SELECT name FROM migrations ORDER BY id DESC LIMIT 3;`
should list `CorrectionsRound41789830000000` and `InAppNotifications1789820000000`.

**Fastest unblock if login is returning 500 right now** (no deploy needed — run in the database):

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS "scoringSlot" smallint;
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS "academicStatus" varchar;
ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS "allocatedAt" timestamptz;
```

## 5. Set up the application (after the migrations)

1. **Reviewer slots.** Existing Scoring Reviewers have no slot, and assigning reviewers is refused until they do.
   Users & Roles → *Edit* → choose **Reviewer 1** for one person and **Reviewer 2** for another. At most two Scoring
   Reviewers may be active; suspend any extras first.
2. **Validators need a state.** Any existing validator without a state must be edited and given one, or their queue
   stays empty.
3. **Two-factor sign-in.** If an account keeps returning *"Invalid or expired MFA code"* (every code and backup code
   rejected), reset it. From another administrator: Users & Roles → *Reset 2FA*. If the only administrator is locked
   out, in the database:
   ```sql
   DELETE FROM mfa_secrets WHERE "userId" = (SELECT id FROM users WHERE email = 'admin@idice.eso.wootlab.ng');
   UPDATE users SET "mfaEnabled" = false WHERE email = 'admin@idice.eso.wootlab.ng';
   ```
   Then **delete every old entry for that account from the authenticator app**, sign in, scan the new QR code **once**,
   and store the new backup codes.
4. **Course catalogue.** The Training page cannot create cohorts until courses exist (`yarn db:seed:prod`, step 3).

## 6. Prove the deployment is correct

```bash
API_URL=https://<api-host>/api/v1 ACCESS_TOKEN=<SYSADMIN access token> yarn check:deployed-routes
```

Every route must be `ok`. A `MISSING` line prints the status and body: *"Cannot GET …"* = the API is older than the
portal (redeploy the backend); an empty or HTML body = a proxy or gateway is answering instead (fix path routing).

Then sign in once as each role and confirm: Administrator, Eligibility Reviewer, Scoring Reviewer, Validator all reach
their dashboard after the 2FA code.

## 7. Monday demo checklist

- **Sign-in and 2FA are limited to 5 attempts per minute per IP.** Signing into several accounts from one network in
  quick succession shows "Too many attempts". Sign in to every account you need **before** the demo and keep the tabs
  open, or leave about a minute between batches.
- Have each demo account's authenticator ready and its backup codes to hand.
- **Youth form:** open `/beneficiary/apply`; the Centre of Excellence list must load. If it shows *"couldn't load the
  list"*, the portal cannot reach the API (check `NEXT_PUBLIC_API_BASE_URL` and `CORS_ORIGINS`).
- **ESO matching:** run matching (proposes only), review, then *Approve* — that is the step that moves applications to
  MATCHED. It needs applications in the validated state with two submitted scores.
- Make sure Reviewer 1 and Reviewer 2 exist before assigning reviewers to an application.

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `POST /auth/login` → 500 "Internal server error" | migrations not run (or the old, broken Migration 2 rolled back) | section 4 SQL, then run the migrations |
| Bell empty / `/notifications` errors | `in_app_notifications` table missing | Migration 1 |
| "That couldn't be found…" or "Validation failed (uuid is expected)" on dashboards | API older than the portal, or a proxy answering | `yarn check:deployed-routes` (section 6) |
| "Invalid or expired MFA code" for every code | stale/mismatched authenticator secret | section 5.3 |
| Assigning reviewers refused ("no reviewer slot") | slots not set | section 5.1 |
| Validator sees an empty queue | no state on the account, or an old backend (the case-sensitive bug) | section 5.2 and redeploy |
| Training: "No courses have been set up yet" | course catalogue not seeded | `yarn db:seed:prod` |
| "Too many attempts" | 5/min rate limit | wait a minute; see section 7 |
| Verify-MFA page bounces to login | the pending sign-in token is single-use and lost on refresh | sign in again |

## 9. Rolling back

`yarn typeorm migration:revert -d dist/database/data-source.js` reverts one migration at a time (`down()` drops the
added columns / table). Restoring the `pg_dump` from section 2 is the complete rollback. Roll the code back
together with the database — the new code will not run on the old schema.

## 10. Not verified / known open items

- **The migrations have not been executed against a real PostgreSQL** by me (none is available in my environment);
  every table and column name was checked against the entity definitions, and the SQL is written defensively. Run on
  staging and read the output before production.
- The SQL integration tests for the PCU filters (`yarn test:sql`, database name must end in `_test`) have not been run.
- The nightly refresh-token cleanup job uses the column name `"updatedAt"`; the real column is `updated_at`, so the
  second of its two deletes fails (it does not affect sign-in).
- NUC / NBTE reports classify institutions by name (there is no regulator column yet).
- Schema drift check (optional): against a copy of the staging database,
  `node ./node_modules/typeorm/cli.js migration:generate src/database/migrations/Drift -d dist/database/data-source.js --dr`
  prints any remaining differences between the entities and the database without writing a file.
