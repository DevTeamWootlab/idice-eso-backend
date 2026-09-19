/**
 * Runs the hand-written / query-builder SQL added for the admin applications list, the PCU
 * aggregation, the graduates/outcomes list, the cohort members list and the beneficiary list
 * against a REAL PostgreSQL database and asserts the exact figures they must return.
 *
 *   docker compose up -d postgres
 *   createdb idice_eso_test            # any name ending in _test
 *   TEST_DB_NAME=idice_eso_test npm run test:sql
 *
 * Connection settings come from TEST_DB_HOST/PORT/USERNAME/PASSWORD, falling back to DB_*.
 * The schema is DROPPED AND RECREATED from the entities, so the database name must end in
 * "_test"; the suite refuses to run otherwise.
 */
import { DataSource } from 'typeorm';
import { getDbConfig } from '../src/database/db-config.util';
import { ApplicationsService } from '../src/modules/applications/applications.service';
import { Application } from '../src/modules/applications/entities/application.entity';
import { BeneficiariesService } from '../src/modules/beneficiaries/beneficiaries.service';
import { Beneficiary } from '../src/modules/beneficiaries/entities/beneficiary.entity';
import { MelService } from '../src/modules/mel/mel.service';
import { OutcomesService } from '../src/modules/outcomes/outcomes.service';
import { EmploymentOutcome } from '../src/modules/outcomes/entities/employment-outcome.entity';
import { TrainingService } from '../src/modules/training/training.service';
import { Cohort } from '../src/modules/training/entities/cohort.entity';
import { CohortMember } from '../src/modules/training/entities/cohort-member.entity';
import { Course } from '../src/modules/training/entities/course.entity';
import { TrainingCompletion } from '../src/modules/training/entities/training-completion.entity';
import { seedRubric } from '../src/database/seeds/rubric.seed';
import { OutcomeFilter } from '../src/modules/outcomes/dto/list-outcomes.dto';

type Row = Record<string, unknown>;
let seq = 0;

/** Inserts a row, auto-filling every NOT NULL column without a default from the live schema. */
async function insertRow(ds: DataSource, table: string, overrides: Row = {}): Promise<string> {
  const columns: Row[] = await ds.query(
    `SELECT column_name, data_type, udt_name, column_default, is_nullable
       FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  if (columns.length === 0) throw new Error(`table ${table} does not exist`);
  const values: Row = {};
  for (const col of columns) {
    const name = col.column_name as string;
    if (name in overrides) { values[name] = overrides[name]; continue; }
    if (col.is_nullable === 'YES' || col.column_default !== null) continue;
    switch (col.data_type) {
      case 'character varying': case 'text': values[name] = `x${++seq}`; break;
      case 'integer': case 'smallint': case 'bigint': case 'numeric': values[name] = 1; break;
      case 'boolean': values[name] = false; break;
      case 'date': values[name] = '2026-01-01'; break;
      case 'timestamp with time zone': case 'timestamp without time zone': values[name] = new Date(); break;
      case 'jsonb': case 'json': values[name] = '{}'; break;
      case 'ARRAY': values[name] = '{}'; break;
      case 'USER-DEFINED': {
        const [label] = await ds.query(
          `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = $1 ORDER BY e.enumsortorder LIMIT 1`,
          [col.udt_name],
        );
        values[name] = label.enumlabel; break;
      }
      default: throw new Error(`${table}.${name} (${col.data_type}) needs an explicit override in this test`);
    }
  }
  const names = Object.keys(values);
  const sql = `INSERT INTO "${table}" (${names.map((n) => `"${n}"`).join(', ')}) VALUES (${names.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`;
  const [row] = await ds.query(sql, names.map((n) => values[n]));
  return row.id as string;
}

describe('new SQL against a real PostgreSQL', () => {
  let ds: DataSource;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    const name = process.env.TEST_DB_NAME;
    if (!name || !name.endsWith('_test')) {
      throw new Error('Set TEST_DB_NAME to a database whose name ends in "_test" (its schema is dropped and recreated).');
    }
    ds = new DataSource({
      ...(getDbConfig() as object),
      host: process.env.TEST_DB_HOST ?? process.env.DB_HOST,
      port: Number(process.env.TEST_DB_PORT ?? process.env.DB_PORT ?? 5432),
      username: process.env.TEST_DB_USERNAME ?? process.env.DB_USERNAME,
      password: process.env.TEST_DB_PASSWORD ?? process.env.DB_PASSWORD,
      database: name,
      ssl: false,
      synchronize: true,
      dropSchema: true,
    } as never);
    await ds.initialize();

    const user = async (key: string, role?: string) => {
      ids[key] = await insertRow(ds, 'users', { email: `${key}@test.ng`, ...(role ? { role } : {}) });
    };
    for (const key of ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'r1', 'r2']) await user(key);

    ids.i1 = await insertRow(ds, 'institutions', { name: 'Alpha University', state: 'Benue', isActive: true });
    ids.i2 = await insertRow(ds, 'institutions', { name: 'Beta Poly', state: 'Kwara', isActive: true });
    ids.i3 = await insertRow(ds, 'institutions', { name: 'Retired Hub', state: 'Niger', isActive: false });

    const app = async (key: string, owner: string, status: string, org: string, states: string[]) => {
      ids[key] = await insertRow(ds, 'applications', {
        applicationRef: `REF-${key.toUpperCase()}`, submittedByOrgId: ids[owner], preferredInstitutionId: ids.i1,
        status, organisationLegalName: org, statesOfOperation: states,
      });
    };
    await app('a1', 'u1', 'SUBMITTED', 'Bright Path Hub', ['BENUE']);
    await app('a2', 'u2', 'IN_REVIEW_SCORING', '100% Hub', ['KWARA', 'BENUE']);
    await app('a3', 'u3', 'IN_REVIEW_SCORING', 'Cedar Labs', ['KWARA']);
    await app('a4', 'u4', 'IN_REVIEW_SCORING', 'Delta Works', ['BENUE']);
    await app('a5', 'u5', 'DRAFT', 'Draft Only', ['BENUE']);
    await app('a6', 'u6', 'SHORTLISTED', 'Eagle Nest', ['BENUE']);
    const assign = (a: string, r: string) => insertRow(ds, 'reviewer_assignments', { applicationId: ids[a], reviewerId: ids[r], queueType: 'SCORING' });
    await assign('a3', 'r1');
    await assign('a4', 'r1');
    await assign('a4', 'r2');

    const ben = async (key: string, name: string, extra: Row) => {
      ids[key] = await insertRow(ds, 'beneficiaries', {
        referenceId: `BEN-${key}`, fullName: name, email: `${key}@ben.ng`, nin: `enc-${key}`, ninHash: `hash-${key}`,
        preferredInstitutionId: ids.i1, assignedInstitutionId: ids.i1, status: 'ALLOCATED', pillar: 'SKILLS', gender: 'MALE', ...extra,
      });
    };
    await ben('b1', 'Ada One', { gender: 'FEMALE' });
    await ben('b2', 'Bola Two', { isNeet: true });
    await ben('b3', 'Chi Three', { gender: 'FEMALE', pillar: 'INCUBATION', assignedInstitutionId: ids.i2, pwdAssistiveRequirement: 'wheelchair' });
    await ben('b4', 'Dayo Four', { gender: 'FEMALE', status: 'SUBMITTED' });
    await ben('b5', 'Efe Five', { gender: 'FEMALE' });
    await ben('b6', 'Femi Six', {});

    ids.c1 = await insertRow(ds, 'courses', { title: 'Web Basics', tier: 'FOUNDATIONAL' });
    ids.c2 = await insertRow(ds, 'courses', { title: 'Data Analysis', tier: 'INTERMEDIATE' });
    ids.co1 = await insertRow(ds, 'cohorts', { name: 'Cohort 1', institutionId: ids.i1, courseId: ids.c1, startDate: '2026-10-05', status: 'ACTIVE' });
    ids.co2 = await insertRow(ds, 'cohorts', { name: 'Cohort 2', institutionId: ids.i1, courseId: ids.c2, startDate: '2026-10-05', status: 'ACTIVE' });
    for (const b of ['b1', 'b2', 'b5', 'b6']) await insertRow(ds, 'cohort_members', { cohortId: ids.co1, beneficiaryId: ids[b], isActive: true });
    await insertRow(ds, 'cohort_members', { cohortId: ids.co2, beneficiaryId: ids.b5, isActive: true });
    const done = (c: string, b: string, extra: Row = {}) => insertRow(ds, 'training_completions', { cohortId: ids[c], beneficiaryId: ids[b], completed: true, ...extra });
    await done('co1', 'b1', { attendanceRate: 91.5 });
    await done('co1', 'b5');
    await done('co2', 'b5');
    await done('co1', 'b6');
    await insertRow(ds, 'training_completions', { cohortId: ids.co1, beneficiaryId: ids.b2, completed: false });
    await insertRow(ds, 'employment_outcomes', { beneficiaryId: ids.b1, outcomeType: 'FREELANCE', verified: false });
    await insertRow(ds, 'employment_outcomes', { beneficiaryId: ids.b5, outcomeType: 'FORMAL_EMPLOYMENT', verified: true });
  });

  afterAll(async () => { if (ds?.isInitialized) await ds.destroy(); });

  const applications = () => {
    const service = Object.create(ApplicationsService.prototype) as ApplicationsService;
    (service as unknown as { applicationRepo: unknown }).applicationRepo = ds.getRepository(Application);
    return service;
  };
  const beneficiaries = () => {
    const service = Object.create(BeneficiariesService.prototype) as BeneficiariesService;
    (service as unknown as { beneficiaryRepo: unknown }).beneficiaryRepo = ds.getRepository(Beneficiary);
    return service;
  };
  const training = () => new TrainingService(ds.getRepository(Cohort), ds.getRepository(CohortMember), ds.getRepository(Course), ds.getRepository(TrainingCompletion), ds);
  const outcomes = () => new OutcomesService(ds.getRepository(EmploymentOutcome), ds);
  const refs = (items: { applicationRef?: string; referenceId?: string; fullName?: string }[]) => items.map((i) => i.applicationRef ?? i.referenceId ?? i.fullName).sort();

  describe('admin applications list + stats', () => {
    it('excludes drafts by default and returns the joined institution', async () => {
      const page = await applications().listForAdmin({});
      expect(page.total).toBe(5);
      expect(refs(page.items)).toEqual(['REF-A1', 'REF-A2', 'REF-A3', 'REF-A4', 'REF-A6']);
      expect(page.items[0].preferredInstitution?.name).toBe('Alpha University');
    });
    it('filters by one or several statuses, and DRAFT only when asked', async () => {
      expect((await applications().listForAdmin({ status: 'SHORTLISTED,SUBMITTED' })).total).toBe(2);
      expect(refs((await applications().listForAdmin({ status: 'DRAFT' })).items)).toEqual(['REF-A5']);
    });
    it('filters by state using the enum-array ANY() predicate', async () => {
      expect(refs((await applications().listForAdmin({ state: 'KWARA' as never })).items)).toEqual(['REF-A2', 'REF-A3']);
      expect((await applications().listForAdmin({ state: 'BENUE' as never })).total).toBe(4);
    });
    it('searches org name or code, treating % and _ literally', async () => {
      expect(refs((await applications().listForAdmin({ search: '100%' })).items)).toEqual(['REF-A2']);
      expect((await applications().listForAdmin({ search: 'bright' })).total).toBe(1);
      expect((await applications().listForAdmin({ search: 'ref-a3' })).total).toBe(1);
      expect((await applications().listForAdmin({ search: '%' })).total).toBe(1);
    });
    it('paginates with an exact total', async () => {
      const page = await applications().listForAdmin({ page: 3, limit: 2 });
      expect(page.total).toBe(5);
      expect(page.totalPages).toBe(3);
      expect(page.items).toHaveLength(1);
    });
    it('counts by status and flags applications still needing two scoring reviewers', async () => {
      const stats = await applications().getAdminStats();
      expect(stats.total).toBe(5);
      expect(stats.drafts).toBe(1);
      expect(stats.byStatus.IN_REVIEW_SCORING).toBe(3);
      expect(stats.awaitingReviewerAssignment).toBe(2);
    });
  });

  describe('PCU aggregation', () => {
    it('computes every KPI from the source tables', async () => {
      const m = await new MelService(ds).getPcuMetrics();
      expect(m.youthEnrolled.value).toBe(5);
      expect(m.femaleParticipation).toMatchObject({ participants: 3, percent: 60 });
      expect(m.startupsIncubated).toMatchObject({ value: 1, coeCount: 2 });
      expect(m.neetPwdInclusion).toMatchObject({ participants: 2, percent: 40 });
      expect(m.jobPlacement).toMatchObject({ placed: 1, completers: 3, percent: 33.3 });
      expect(m.skillTiers.map((t) => t.completed)).toEqual([3, 1, 0]);
      expect(m.perCoe.map((c) => [c.name, c.youthEnrolled, c.startupsIncubated])).toEqual([
        ['Alpha University', 4, 0],
        ['Beta Poly', 1, 1],
      ]);
    });
  });

  describe('graduates / outcomes list', () => {
    it('lists only people who completed a course, with their outcome', async () => {
      const page = await outcomes().listCandidates({});
      expect(page.total).toBe(3);
      expect(refs(page.items)).toEqual(['Ada One', 'Efe Five', 'Femi Six']);
    });
    it('filters by outcome state', async () => {
      expect(refs((await outcomes().listCandidates({ outcome: OutcomeFilter.NONE })).items)).toEqual(['Femi Six']);
      expect(refs((await outcomes().listCandidates({ outcome: OutcomeFilter.UNVERIFIED })).items)).toEqual(['Ada One']);
      expect(refs((await outcomes().listCandidates({ outcome: OutcomeFilter.VERIFIED })).items)).toEqual(['Efe Five']);
    });
    it('searches and pages', async () => {
      expect((await outcomes().listCandidates({ search: 'efe' })).total).toBe(1);
      const page = await outcomes().listCandidates({ page: 2, limit: 2 });
      expect(page.items).toHaveLength(1);
      expect(page.totalPages).toBe(2);
    });
  });

  describe('cohort members + beneficiary list', () => {
    it('returns members with their completion state', async () => {
      const members = await training().listMembers(ids.co1);
      expect(members).toHaveLength(4);
      const ada = members.find((m) => m.fullName === 'Ada One');
      expect(ada).toMatchObject({ completed: true, certified: false, attendanceRate: 91.5 });
      expect(members.find((m) => m.fullName === 'Bola Two')).toMatchObject({ completed: false, attendanceRate: null });
    });
    it('lists beneficiaries with filters and never selects NIN data', async () => {
      const all = await beneficiaries().listForAdmin({});
      expect(all.total).toBe(6);
      expect((await beneficiaries().listForAdmin({ status: 'ALLOCATED' as never })).total).toBe(5);
      expect((await beneficiaries().listForAdmin({ pillar: 'INCUBATION' as never })).total).toBe(1);
      expect((await beneficiaries().listForAdmin({ institutionId: ids.i2 })).total).toBe(1);
      expect((await beneficiaries().listForAdmin({ search: 'ada' })).total).toBe(1);
      expect(JSON.stringify(all.items)).not.toContain('enc-b1');
      expect(JSON.stringify(all.items)).not.toContain('hash-b1');
    });
  });
  describe('rubric seed', () => {
    it('inserts the six defaults, and re-running it never overwrites an edited weight', async () => {
      await seedRubric(ds.manager);
      await ds.query(`UPDATE rubric_configurations SET "weightPercentage" = 30 WHERE "dimensionCode" = 'LOCAL_PRESENCE'`);
      await seedRubric(ds.manager);
      const rows = await ds.query(`SELECT "dimensionCode", "weightPercentage" FROM rubric_configurations ORDER BY "dimensionCode"`);
      expect(rows).toHaveLength(6);
      expect(Number(rows.find((r: { dimensionCode: string }) => r.dimensionCode === 'LOCAL_PRESENCE').weightPercentage)).toBe(30);
    });
  });
});
