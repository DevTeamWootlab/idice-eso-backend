# Azure Production Runbook

For the exact first-deployment sequence and required accounts, permissions, GitHub values, verification, and rollback actions, use the [production deployment checklist](AZURE-DEPLOYMENT-TODO.md) before this reference runbook.

## Architecture

- GitHub Actions builds and scans an immutable container image, publishes it to Azure Container Registry, then updates the App Service staging slot.
- Azure App Service for Linux runs the API container on Node.js 26. App Service handles HTTPS termination, process restarts, health checks, and CPU-based scale-out.
- Azure Database for PostgreSQL Flexible Server is private to a delegated subnet. The API connects over VNet integration; PostgreSQL is not in Docker Compose in Azure.
- Azure Key Vault stores runtime secrets. App Service uses managed identity and Key Vault references; secret values are not copied into the image or committed to the repository.
- The staging slot runs pending TypeORM migrations and the idempotent reference seed under a PostgreSQL advisory lock. The workflow checks `/api/v1/health/ready` and swaps only when status is `UP` and `database_connected` is `true`.
- Azure Monitor diagnostics go to Log Analytics. PostgreSQL backups are retained for 35 days; geo-redundancy is an explicit regional option, and App Service autoscaling is configured from one to three S1 workers.

Local API plus local PostgreSQL:

```bash
docker compose up --build
```

Production uses App Service plus managed PostgreSQL; do not deploy the local PostgreSQL Compose service to Azure.

## First-Release Migration Gate

The migration sources in this change include the initial schema and subsequent migrations. Include and review all migration files in the release commit; do not attempt a first production deployment from a checkout that omits them. The release workflow runs `scripts/validate-migration-baseline.mjs`, builds the production JavaScript, and applies that compiled migration chain to a fresh PostgreSQL 16 service before any deployment can run.

The initial migration explicitly enables `uuid-ossp` for a new Azure PostgreSQL database. CI verifies the full migration sequence against an empty PostgreSQL 16 database using the same compiled data source the container runs. Before production, also rehearse the sequence against a disposable copy of any existing database schema and data, confirm `yarn db:migration:show:prod` reports the expected migrations, and confirm `\dt public.*` lists the application tables after migration. Commit every migration source; `.gitignore` permits `src/database/migrations/*.ts` to be tracked.

Do not bypass the guard, enable TypeORM `synchronize`, mark migrations as run by hand, or drop a database containing data. Production migrations should be additive/expand-contract so both the old and new API versions can operate during a slot swap. PostgreSQL transactional DDL rolls back many failed migrations, but not every operation is safely reversible.

## GitHub OIDC Setup

Create the target Azure resource group once with an owner-operated account, then create an Entra ID application/service principal for GitHub Actions. The workflow intentionally verifies rather than creates the resource group, so the GitHub identity can remain scoped to that resource group. Add a federated credential with:

- Issuer: `https://token.actions.githubusercontent.com`
- Subject: `repo:<OWNER>/<REPOSITORY>:environment:production`
- Audience: `api://AzureADTokenExchange`

Create the GitHub Actions `production` environment and require reviewer approval. Configure environment protection for the `main` branch. Grant the deployment principal the minimum permissions needed to deploy resources and create role assignments in the target resource group; assigning role assignments requires `User Access Administrator` or `Owner` in addition to deployment permissions. The Bicep template grants that principal `AcrPush` on the registry. Set `AZURE_GITHUB_PRINCIPAL_OBJECT_ID` to the enterprise application/service-principal object ID, not the app-registration client ID.

Configure these GitHub `production` environment variables:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RESOURCE_GROUP`
- `AZURE_LOCATION`
- `AZURE_APP_SERVICE_NAME`
- `AZURE_ACR_NAME`
- `AZURE_POSTGRES_SERVER_NAME`
- `AZURE_KEY_VAULT_NAME`
- `AZURE_DATABASE_NAME`
- `AZURE_DATABASE_ADMIN_LOGIN`
- `AZURE_GITHUB_PRINCIPAL_OBJECT_ID`
- `FRONTEND_URL`
- `CORS_ORIGINS` (comma-separated HTTPS origins)
- `MAIL_FROM_ADDRESS`

Configure these GitHub `production` environment secrets. They are bootstrap inputs; runtime secret references resolve from Key Vault:

- `DATABASE_ADMIN_PASSWORD`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `MFA_ENCRYPTION_KEY`, `NIN_HASH_KEY`, `NIN_ENCRYPTION_KEY`
- `MAIL_API_KEY`, `SMS_API_KEY`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `SYSADMIN_SEED_PASSWORD`

Use globally unique, DNS-compatible names for the App Service, ACR, PostgreSQL server, and Key Vault. PostgreSQL admin credentials must satisfy Azure's password rules. JWT secrets must be at least 32 characters; MFA/NIN keys must each be exactly 64 hexadecimal characters. Never rotate MFA/NIN encryption or hash keys without a reviewed data re-encryption plan.

## Provisioning

1. Review `infra/azure/main.bicep` and `infra/azure/parameters.example.json`; use the example only as a shape reference. Do not put real secret values in that file.
2. Run the GitHub Actions workflow **Provision Azure Infrastructure** manually from the `main` branch. It validates inputs, writes a mode-0600 temporary parameter file on the runner, runs Bicep `what-if`, applies the template, and deletes the temporary file even on failure.
3. Inspect the workflow output and Azure resource group. Confirm PostgreSQL has public network access disabled, the Key Vault has soft delete/purge protection and a private endpoint, ACR admin user is disabled, App Service is HTTPS-only, and both App Service slots have managed identities.
4. Allow time for role assignments and Key Vault references to propagate. The infrastructure workflow places a placeholder image on App Service; it is not the API and must not receive production traffic.

The private Key Vault is populated by the infrastructure deployment through secure Bicep parameters. Key Vault values are not printed by the workflow. Access to GitHub production secrets and the Azure production environment should be restricted to deployment operators.

## Delivery Flow

A pull request to `main` runs frozen-lockfile install, Oxlint, Jest, Nest build, a production-container build and vulnerability scan, the compiled TypeORM chain against a new PostgreSQL 16 service, dependency audit, and Trivy filesystem vulnerability/secret/misconfiguration scans. A push to `main` repeats verification, checks the migration baseline, builds an image tagged with the commit SHA, and scans the exact image before deploying.

The workflow updates staging only. `RUN_MIGRATIONS=true` is a sticky slot setting; production keeps it false after swap. The container bootstrap uses a PostgreSQL advisory lock so concurrent staging workers serialize migration and seed operations. A migration or seed failure terminates container startup and blocks the health gate. The workflow then waits for database-aware health, swaps staging into production, verifies production, and attempts to swap back if production health fails.

Do not use `latest` as the deployment identity; commit-SHA tags make each release traceable and repeatable. Keep production migrations backward-compatible with the currently live code. Database changes that cannot be backward-compatible need a separately planned maintenance window and rollback strategy.

## Validation and Operations

Before enabling deployment, run locally:

```bash
yarn install --frozen-lockfile
yarn lint
yarn test --runInBand --ci
yarn build
node scripts/validate-migration-baseline.mjs
yarn db:migrate:prod
docker compose config
docker compose up --build
```

`yarn db:migrate:prod` requires the PostgreSQL 16 CI service or a disposable local PostgreSQL database configured through the `DB_*` environment variables. Do not point migration rehearsals at production. Copy `.env.example` to `.env` and supply local-only values before starting Compose; never reuse production secrets locally.

After a release, verify:

```bash
curl --fail https://<app-service-name>.azurewebsites.net/api/v1/health
```

Expected response is wrapped as `{ "data": { "status": "UP", "database_connected": true, ... } }`. Use `/api/v1/health/ready` for load-balancer and deployment checks: it returns HTTP 503 if PostgreSQL is unavailable. In PostgreSQL, check:

```sql
SELECT current_database(), current_schema(), current_user;
SELECT id, timestamp, name FROM public.migrations ORDER BY id;
\dt public.*
```

Use `az webapp log tail --resource-group <group> --name <app> --slot staging` for a failed staging boot. Query Log Analytics for App Service/PostgreSQL diagnostic records. Do not emit secrets in logs or pass secret literals as CLI arguments.

Before enabling a custom domain, add its DNS records, validate domain ownership in App Service, bind an App Service managed certificate, and confirm HTTPS redirection/HTTPS-only behavior. Ensure the portal origin is included in `CORS_ORIGINS` and `FRONTEND_URL` points to the matching portal environment.

## Cost and Availability Notes

The defaults are a starting point, not a workload guarantee. S1 App Service, General Purpose PostgreSQL, Log Analytics ingestion, private endpoints, and autoscaling are billable. PostgreSQL high availability and geo-redundant backups are optional and disabled by default; enable them only with an appropriate supported SKU, region, availability-zone support, and approved recovery objective. Set Azure budgets/alerts before provisioning and review backup retention, autoscale bounds, storage growth, and regional recovery requirements with the service owner.
