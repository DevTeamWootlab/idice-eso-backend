<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ yarn install
```

```bash
### command to generate keys for nin and haskey for the .env file
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
NIN_HASH_KEY=haskey
NIN_ENCRYPTION_KEY=generated_encyrption
```

## Compile and run the project

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```

## Run tests

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```

## Database migrations

Start the local PostgreSQL database with Docker, then apply migrations and seed
the PRD reference data:

```bash
docker compose up -d postgres
npm.cmd run db:migration:generate
npm.cmd run db:migrate
npm.cmd run db:seed
```

The seed is idempotent and loads the 11 Centres of Excellence, the full
60/30/10 training course catalogue, and the six scoring rubric dimensions.

To generate the first schema migration from the current entities:

```bash
npm.cmd run db:migration:generate
npm.cmd run db:migrate
```

On a server, do not run `db:migration:generate`. That command compares the
current entities with the database and exits with code 1 when there are no
changes; it does not apply existing migrations. Build the application, then
run the committed migrations against the production database:

```bash
yarn build
yarn db:migrate:prod
yarn db:seed:prod
yarn start:prod
```

The seed is separate from migrations. To run both deployment database steps in
one command, use `yarn deploy:prod`. The seed is idempotent and can be run
again safely; it inserts or updates reference data without duplicating it.

Keep `synchronize` disabled. Review generated migrations before applying them
to a shared or production database.

## Emailed links (FRONTEND_URL)

Verification and password-reset emails link to `${FRONTEND_URL}/verify-email?token=…` and
`${FRONTEND_URL}/reset-password/confirm?token=…`. `FRONTEND_URL` must be the public **https**
URL of the portal build that talks to *this* backend (e.g. staging backend →
`https://staging.idice.eso.wootlab.ng`, production backend → `https://idice.eso.wootlab.ng`),
and that portal build must include the `/verify-email` and `/reset-password/confirm` pages.
A mismatch shows up as a 404 (host serves an older portal build) or an "invalid token"
message (host talks to a different backend/database). The API logs a warning at startup when
it runs in production with a localhost or non-https `FRONTEND_URL`.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ yarn install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observer](https://observer.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

## Deploying: order of operations

1. **Schema.** The in-app notification inbox added a table (`in_app_notifications`). With `synchronize`
   off, it only exists once a migration is applied. Against a database at the previous schema run
   `yarn db:migration:generate`, review the generated file, commit it, then apply with `yarn deploy:prod`
   (`db:migrate:prod` + `db:seed:prod`).
2. **Seed.** `yarn db:seed:prod` loads the CoEs, the full course catalogue and the six scoring rubric
   dimensions. It is safe to run on every deploy: the rubric seed only inserts *missing* dimensions and never
   overwrites weights an administrator has edited.
3. **`FRONTEND_URL`.** Must be the public https URL of the portal build that talks to this API. Emailed links
   (`/verify-email`, `/reset-password/confirm`, `/eso/dashboard`) are built from it. After deploying the portal,
   gate the release:

   ```bash
   FRONTEND_URL=https://portal.example npm run check:emailed-links
   ```

   In production the API also probes those pages on startup and logs an error if they do not resolve.

## Verifying against a real database

`npm run test:sql` runs the query-builder SQL (admin applications list and stats, PCU aggregation,
graduates/outcomes list, cohort members, beneficiary list, rubric re-seed) against a real PostgreSQL and asserts
exact figures. It **drops and recreates the schema**, so `TEST_DB_NAME` must end in `_test`:

```bash
docker compose up -d postgres
createdb idice_eso_test        # or create it with any client
TEST_DB_NAME=idice_eso_test npm run test:sql
```

Connection settings come from `TEST_DB_HOST/PORT/USERNAME/PASSWORD`, falling back to `DB_*`. Fixtures are built
from the live schema (required columns are introspected), so schema changes rarely need test edits.

## Staging smoke test

`scripts/staging-smoke.mjs` exercises the real deployed API end to end: public intake, allocate, cohort,
enrol, complete, verified placement, then checks the PCU dashboard moved by exactly the expected amounts.

```bash
API_URL=https://staging-api.example/api/v1 \
ACCESS_TOKEN=<SYSADMIN access token> \
SMOKE_CONFIRM=I_UNDERSTAND_THIS_WRITES_DATA \
node scripts/staging-smoke.mjs
```

Internal roles require MFA, so sign in once (portal or Swagger) and pass that access token. The script writes
data (one youth named "SMOKE TEST …", one cohort, one outcome) and there are no delete endpoints, so use staging.
It exits non-zero on any failed step.

## API documentation (Swagger)

Interactive docs are served at `/api/docs`. Every successful response is wrapped as
`{ "status": true, "timestamp": <ms>, "data": … }`; the documented schemas describe `data`.

`npm run docs:check` fails when a route lacks `@ApiOperation`, an auth annotation (unless `@Public`) or a
documented response, repeats a decorator, or when a request DTO property lacks `@ApiProperty`. It compares against
`scripts/swagger-baseline.json` (currently empty), so any new gap fails CI. Run it with `--update-baseline` only
to record deliberate exceptions.

## Behaviour worth knowing

- **Scoring weights** are stored in `rubric_configurations`, editable by SYSADMIN atdonalds
  `PUT /internal/settings/scoring-weights` (must total 100). They lock as soon as any score card is submitted, so
  every application is scored on the same basis. If stored rows are incomplete or do not total 100, scoring falls
  back to the PRD defaults (20/20/15/15/15/15).
- **Applicant visibility.** `GET /applications/:id/activity` returns only whitelisted milestones
  (`src/modules/applications/applicant-activity.ts`); `GET /applications/:id/match` returns the host institution
  only once the application is MATCHED, never the match score. Widen these deliberately, with a test.
- **In-app notifications** are created best-effort next to the existing emails and never block or fail them.
