# Production deployment checklist

Use this checklist once, in order, for the first live deployment. Do not replace a checked item with a manual server change: the Bicep template and GitHub Actions workflows are the source of truth.

## 0. Release owner and stop conditions

- [ ] Name a release owner and a separate GitHub `production` environment reviewer.
- [ ] Confirm the code, IaC, Docker files, workflows, and all migration files are committed to `main`.
- [ ] Confirm the source migration chain works against **both** a new PostgreSQL 16 database and a copy of the current database. The CI workflow repeats the empty-database test, but the upgrade test needs a protected staging copy.
- [ ] Install Node.js 26 locally if running the preflight commands. This repository declares Node 26 as its supported runtime.
- [ ] Rotate any credential that has ever been committed, shared in a chat, screen recording, terminal output, or unprotected file. Keep production values only in the GitHub `production` environment secrets.
- [ ] Record the release commit SHA, expected public API URL, frontend URL, owner, and rollback contact in the release ticket.

Stop here if a migration is destructive, cannot run while the old API is live, or has not been tested on a copy of production. The slot swap protects application availability; it cannot undo an unsafe database migration.

## 1. Azure subscription and names

- [ ] Choose a supported production region that meets data residency, PostgreSQL high-availability, and geo-backup requirements.
- [ ] Enable a budget and cost alert for the subscription before creating resources.
- [ ] With an owner-operated Azure account, create the resource group once. The GitHub identity intentionally does **not** create resource groups.

  ```bash
  az group create --name <resource-group> --location <azure-region>
  ```

- [ ] Choose globally unique, lowercase DNS-safe names. Keep a record of each one:

  | Setting | Constraint | Example shape |
  | --- | --- | --- |
  | `AZURE_APP_SERVICE_NAME` | 2–24 characters | `idice-eso-api-prod` |
  | `AZURE_ACR_NAME` | 5–50 alphanumeric characters | `idiceesoprod123` |
  | `AZURE_POSTGRES_SERVER_NAME` | 3–63 characters | `idice-eso-pg-prod` |
  | `AZURE_KEY_VAULT_NAME` | 3–24 characters | `idice-eso-kv-prod` |

- [ ] Decide whether regional support and the recovery objective justify enabling PostgreSQL high availability and geo-redundant backup. They are disabled by default to prevent a failed deployment in unsupported regions; the 35-day backup retention is enabled.

## 2. GitHub-to-Azure identity (OIDC)

- [ ] Create a Microsoft Entra application and service principal for this repository’s deployment automation. Do **not** create a client secret.
- [ ] Create a federated credential with the following values:
  - Issuer: `https://token.actions.githubusercontent.com`
  - Subject: `repo:<GitHub-owner>/<repository>:environment:production`
  - Audience: `api://AzureADTokenExchange`
- [ ] At the **pre-created resource group** scope, grant the service principal:
  - `Contributor`
  - `User Access Administrator` — required only because the Bicep deployment grants the App Service identities `AcrPull` and `Key Vault Secrets User`, and grants the GitHub principal `AcrPush`.
- [ ] Save these identifiers:

  ```bash
  # Client ID for GitHub Actions
  az ad app show --id <application-client-id> --query appId -o tsv

  # Object ID for AZURE_GITHUB_PRINCIPAL_OBJECT_ID (not the client ID)
  az ad sp show --id <application-client-id> --query id -o tsv

  # Tenant and subscription IDs
  az account show --query '{tenantId:tenantId, subscriptionId:id}' -o json
  ```

Azure’s current OIDC guidance is [here](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure-openid-connect).

## 3. Protect the GitHub production environment

- [ ] In GitHub: **Settings → Environments → New environment → `production`**.
- [ ] Require one or more reviewers, restrict deployments to `main`, and restrict who can edit environment values.
- [ ] Add these **environment variables** exactly as named:

  ```text
  AZURE_CLIENT_ID
  AZURE_TENANT_ID
  AZURE_SUBSCRIPTION_ID
  AZURE_RESOURCE_GROUP
  AZURE_LOCATION
  AZURE_APP_SERVICE_NAME
  AZURE_ACR_NAME
  AZURE_POSTGRES_SERVER_NAME
  AZURE_KEY_VAULT_NAME
  AZURE_DATABASE_NAME
  AZURE_DATABASE_ADMIN_LOGIN
  AZURE_GITHUB_PRINCIPAL_OBJECT_ID
  FRONTEND_URL
  CORS_ORIGINS
  MAIL_FROM_ADDRESS
  ```

- [ ] Add these **environment secrets** exactly as named. Generate long, unique values; do not reuse local-development credentials.

  ```text
  DATABASE_ADMIN_PASSWORD
  JWT_ACCESS_SECRET
  JWT_REFRESH_SECRET
  MFA_ENCRYPTION_KEY
  NIN_HASH_KEY
  NIN_ENCRYPTION_KEY
  MAIL_API_KEY
  SMS_API_KEY
  CLOUDINARY_CLOUD_NAME
  CLOUDINARY_API_KEY
  CLOUDINARY_API_SECRET
  SYSADMIN_SEED_PASSWORD
  ```

- [ ] Validate secret formats before saving: JWT secrets are at least 32 characters; MFA/NIN keys are exactly 64 hexadecimal characters; the database password meets Azure PostgreSQL password rules.
- [ ] Set `FRONTEND_URL` and every `CORS_ORIGINS` value to real HTTPS portal origins. Include no wildcard origins.

## 4. Local preflight

- [ ] From the repository root, run:

  ```bash
  yarn install --frozen-lockfile
  yarn lint
  yarn test --runInBand --ci
  yarn build
  node scripts/validate-migration-baseline.mjs
  docker compose config --quiet
  ```

- [ ] Start the local stack when Docker is available:

  ```bash
  docker compose up --build
  ```

- [ ] Verify `http://localhost:3000/api/v1/health/ready` returns HTTP 200 and `database_connected: true`.
- [ ] Stop the local stack after verification. Do not point local commands at the future production database.

## 5. Provision infrastructure

- [ ] Push this deployment configuration to `main`.
- [ ] In GitHub Actions, run **Provision Azure Infrastructure** from `main`; approve the protected `production` environment.
- [ ] Review the `what-if` output before approving any unexpected creation, deletion, or replacement.
- [ ] Wait for the workflow to finish successfully. It creates the private VNet, PostgreSQL Flexible Server, Key Vault, ACR, Linux App Service plan, production app, staging slot, identities, role assignments, diagnostics, and autoscale policy.
- [ ] In Azure, confirm:
  - PostgreSQL public network access is disabled.
  - Key Vault has purge protection, soft delete, private endpoint, and RBAC enabled.
  - ACR admin user is disabled.
  - Both App Service slots use managed identities and HTTPS-only is enabled.
  - App Service health path is `/api/v1/health/ready`.
  - The production app’s `DB_PASSWORD`, JWT, mail, SMS, Cloudinary, MFA, and NIN settings are Key Vault references, not plaintext values.

The placeholder image is expected to be unhealthy until the first application delivery. App Service resolves Key Vault references using managed identity; Microsoft’s managed identity and Key Vault guidance is [here](https://learn.microsoft.com/en-us/azure/app-service/tutorial-connect-msi-key-vault-javascript).

## 6. Configure the public endpoint

- [ ] Initially use `https://<AZURE_APP_SERVICE_NAME>.azurewebsites.net` only for the controlled first-release test.
- [ ] Before public launch, add the API custom domain in App Service, create the required DNS record, validate ownership, and bind an App Service managed certificate.
- [ ] Update `FRONTEND_URL` and `CORS_ORIGINS` if the final portal or API domain differs from the value used during provisioning, then rerun the infrastructure workflow.
- [ ] Confirm HTTPS-only redirection and test the browser CORS flow from the real portal.

## 7. First release

- [ ] Merge the approved production commit into `main`.
- [ ] Approve **Azure Production Delivery** in the GitHub `production` environment.
- [ ] Watch the workflow. It must complete these gates in order:
  1. lint, tests, build, clean PostgreSQL migration test, dependency audit, and Trivy filesystem scan;
  2. migration-baseline validation;
  3. immutable image build, SBOM/provenance generation, ACR push, and image scan;
  4. staging-slot image update;
  5. serialized TypeORM migration and idempotent seed in staging;
  6. `/api/v1/health/ready` success with a live database connection;
  7. staging-to-production slot swap and production readiness verification.
- [ ] Do not manually run migrations, SSH to a server, copy files, or set runtime secrets in the container.

Azure recommends the same deployment-slot-and-swap pattern for custom containers to avoid downtime: [App Service deployment best practices](https://learn.microsoft.com/en-us/azure/app-service/deploy-best-practices).

## 8. Acceptance checks after the swap

- [ ] Confirm `https://<api-domain>/api/v1/health/ready` returns HTTP 200, `status: "UP"`, and `database_connected: true`.
- [ ] Confirm the `version` field is the expected commit SHA.
- [ ] Sign in through the production portal, complete MFA, run a representative read/write operation, upload a test file, and verify email/SMS delivery if enabled.
- [ ] In Log Analytics, confirm App Service, PostgreSQL, and Key Vault diagnostic records are arriving.
- [ ] Create alert rules for unavailable App Service health, high HTTP 5xx rate, PostgreSQL CPU/storage saturation, and Key Vault access failures. Route them to the on-call owner.
- [ ] Record the successful release SHA and health-check result in the release ticket.

## 9. Rollback and incident rules

- [ ] If staging migrations or readiness fail, do not swap. Fix forward and rerun the release.
- [ ] If production readiness fails immediately after the swap, the workflow attempts an automatic reverse swap. Confirm the old version is healthy.
- [ ] For a manual application rollback, swap the slots back:

  ```bash
  az webapp deployment slot swap \
    --resource-group <resource-group> \
    --name <app-service-name> \
    --slot staging \
    --target-slot production
  ```

- [ ] Do not blindly revert database migrations. Restore a tested backup or execute a reviewed rollback only when it is compatible with the code being restored.
- [ ] Rotate a compromised secret in Key Vault, restart the affected slot/app to refresh the reference, then verify the service. Do not rotate MFA or NIN encryption keys without a data re-encryption plan.
