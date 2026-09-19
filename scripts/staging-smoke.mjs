#!/usr/bin/env node
/**
 * End-to-end smoke test of the programme pipeline against a REAL deployed API:
 * public intake -> allocate -> cohort -> enrol -> complete -> verified placement,
 * then checks the PCU dashboard moved by exactly the expected amounts.
 *
 *   API_URL=https://staging-api.example/api/v1 \
 *   ACCESS_TOKEN=<SYSADMIN access token> \
 *   SMOKE_CONFIRM=I_UNDERSTAND_THIS_WRITES_DATA \
 *   node scripts/staging-smoke.mjs
 *
 * WRITES DATA (one youth, one cohort, one outcome — there are no delete endpoints), so
 * run it against staging only. The intake record is named "SMOKE TEST" with a
 * smoke-*@example.invalid email so it is easy to find and clean up in the database.
 *
 * Internal roles require MFA, so log in once in the portal / Swagger and pass that
 * access token (valid ~15 minutes). Exit code 1 if any step fails.
 */
const API_URL = (process.env.API_URL ?? '').replace(/\/+$/, '');
const TOKEN = process.env.ACCESS_TOKEN ?? '';
if (!/^https?:\/\//.test(API_URL) || !TOKEN) {
  console.error('Set API_URL (…/api/v1) and ACCESS_TOKEN (a SYSADMIN access token).');
  process.exit(2);
}
if (process.env.SMOKE_CONFIRM !== 'I_UNDERSTAND_THIS_WRITES_DATA') {
  console.error('This script writes data. Set SMOKE_CONFIRM=I_UNDERSTAND_THIS_WRITES_DATA to proceed (staging only).');
  process.exit(2);
}

let passed = 0, failed = 0;
const state = {};
async function api(method, path, { query, body, auth = true } = {}) {
  const url = new URL(API_URL + path);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== '') url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${TOKEN}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${typeof json === 'string' ? json : JSON.stringify(json?.message ?? json)}`);
  return json && typeof json === 'object' && 'data' in json ? json.data : json;
}
const eq = (actual, expected, what) => { if (actual !== expected) throw new Error(`${what}: expected ${expected}, got ${actual}`); };
const has = (obj, keys, what) => { for (const k of keys) if (!(k in obj)) throw new Error(`${what} is missing "${k}"`); };
async function step(name, fn) {
  try { await fn(); passed++; console.log(`  PASS  ${name}`); }
  catch (err) { failed++; console.log(`  FAIL  ${name}\n        ${err.message}`); }
}
const stamp = Date.now().toString(36);
const digits = () => String(Math.floor(1e10 + Math.random() * 9e10)).slice(0, 11);

console.log(`Smoke test against ${API_URL}\n`);

await step('API is healthy (public, enveloped, status UP)', async () => {
  const health = await api('GET', '/health', { auth: false });
  eq(health.status, 'UP', 'health.status');
});

await step('token is a SYSADMIN (PCU metrics readable) — baseline captured', async () => {
  state.before = await api('GET', '/internal/pcu/metrics');
  has(state.before, ['youthEnrolled', 'femaleParticipation', 'startupsIncubated', 'jobPlacement', 'neetPwdInclusion', 'skillTiers', 'perCoe', 'generatedAt'], 'PCU metrics');
  eq(state.before.skillTiers.length, 3, 'skillTiers length');
});

await step('admin applications list + stats respond with the documented shape', async () => {
  const list = await api('GET', '/internal/admin/applications', { query: { page: 1, limit: 5 } });
  has(list, ['items', 'total', 'page', 'limit', 'totalPages'], 'applications list');
  const stats = await api('GET', '/internal/admin/applications/stats');
  has(stats, ['total', 'drafts', 'byStatus', 'awaitingReviewerAssignment'], 'applications stats');
});

await step('institutions and seeded courses are available', async () => {
  const institutions = await api('GET', '/institutions/public', { auth: false });
  if (!institutions.length) throw new Error('no institutions — run the seed (yarn db:seed:prod)');
  state.institution = institutions[0];
  const courses = await api('GET', '/internal/training/courses');
  if (!courses.length) throw new Error('no courses — run the seed (yarn db:seed:prod)');
  state.course = courses.find((c) => c.tier === 'FOUNDATIONAL') ?? courses[0];
});

await step('public intake accepts a Skills-pillar youth', async () => {
  state.email = `smoke-${stamp}@example.invalid`;
  const created = await api('POST', '/beneficiaries', {
    auth: false,
    body: {
      fullName: `SMOKE TEST ${stamp}`, dateOfBirth: '2002-05-14', gender: 'FEMALE', phoneNumber: `+234${digits().slice(0, 10)}`,
      email: state.email, nin: digits(), isNeet: false, isCurrentStudent: false, isRecentGraduate: true, academicStatus: 'RECENT_GRADUATE',
      stateOfOrigin: 'BENUE', stateOfResidence: 'BENUE', lga: 'Makurdi', homeAddress: '1 Smoke Test Road',
      pillar: 'SKILLS', preferredInstitutionId: state.institution.id, ndprConsentGiven: true, codeOfConductAccepted: true,
      skillsProfile: { preferredHubType: 'STANDARD', skillTier: 'FOUNDATIONAL', specificSkillArea: 'Customer service', highestEducationLevel: 'OND', ownsPersonalDevice: true, hasReliableInternet: true },
    },
  });
  has(created, ['id', 'referenceId'], 'intake response');
  state.referenceId = created.referenceId;
});

await step('beneficiary list finds the youth (status SUBMITTED, no NIN data leaked)', async () => {
  const page = await api('GET', '/internal/beneficiaries', { query: { search: state.email } });
  eq(page.total, 1, 'matches');
  const [row] = page.items;
  has(row, ['id', 'referenceId', 'fullName', 'pillar', 'status', 'assignedInstitution'], 'beneficiary row');
  eq(row.status, 'SUBMITTED', 'status');
  if (JSON.stringify(row).match(/"nin(Hash)?"/)) throw new Error('NIN fields present in list response');
  state.beneficiaryId = row.id;
});

await step('invalid transition is refused with a clear message (SUBMITTED -> SUBMITTED)', async () => {
  let refused = false;
  try { await api('PATCH', `/internal/beneficiaries/${state.beneficiaryId}/status`, { body: { status: 'SUBMITTED' } }); } catch (e) { refused = /400/.test(e.message); }
  if (!refused) throw new Error('expected a 400');
});

await step('allocate the youth to a CoE (this is what "enrolled" counts)', async () => {
  const updated = await api('PATCH', `/internal/beneficiaries/${state.beneficiaryId}/status`, { body: { status: 'ALLOCATED', institutionId: state.institution.id } });
  eq(updated.status, 'ALLOCATED', 'status');
  eq(updated.assignedInstitution?.id, state.institution.id, 'assigned institution');
});

await step('create + start a cohort at that CoE', async () => {
  const cohort = await api('POST', '/internal/training/cohorts', { body: { name: `SMOKE ${stamp}`, institutionId: state.institution.id, courseId: state.course.id, startDate: '2026-10-05', capacity: 5 } });
  eq(cohort.status, 'PLANNED', 'cohort status');
  state.cohortId = cohort.id;
  eq((await api('PATCH', `/internal/training/cohorts/${state.cohortId}/status`, { body: { status: 'ACTIVE' } })).status, 'ACTIVE', 'cohort status');
});

await step('enrol the allocated youth; members list shows them not yet completed', async () => {
  const result = await api('POST', `/internal/training/cohorts/${state.cohortId}/enroll`, { body: { beneficiaryIds: [state.beneficiaryId] } });
  eq(result.enrolled.length, 1, 'enrolled count');
  const members = await api('GET', `/internal/training/cohorts/${state.cohortId}/members`);
  const member = members.find((m) => m.beneficiaryId === state.beneficiaryId);
  if (!member) throw new Error('member not listed');
  eq(member.completed, false, 'completed');
});

await step('cohort listing reports the member count', async () => {
  const cohorts = await api('GET', '/internal/training/cohorts');
  const mine = cohorts.find((c) => c.id === state.cohortId);
  eq(mine?.memberCount, 1, 'memberCount');
  has(mine, ['institution', 'course'], 'cohort');
});

await step('record completion + certification', async () => {
  const result = await api('POST', `/internal/training/cohorts/${state.cohortId}/completions`, { body: { records: [{ beneficiaryId: state.beneficiaryId, completed: true, certified: true, attendanceRate: 95 }] } });
  eq(result.saved, 1, 'saved');
  eq(result.rejected.length, 0, 'rejected');
});

await step('graduate appears in placements with no outcome yet', async () => {
  const page = await api('GET', '/internal/outcomes', { query: { search: state.referenceId, outcome: 'NONE' } });
  eq(page.total, 1, 'matches');
  eq(page.items[0].outcome, null, 'outcome');
});

await step('record a verified placement', async () => {
  const outcome = await api('POST', '/internal/outcomes', { body: { beneficiaryId: state.beneficiaryId, outcomeType: 'FREELANCE', employerOrVentureName: 'Smoke Test Ltd', achievedOn: '2026-11-20', verified: true } });
  eq(outcome.verified, true, 'verified');
  const page = await api('GET', '/internal/outcomes', { query: { search: state.referenceId, outcome: 'VERIFIED' } });
  eq(page.total, 1, 'verified matches');
});

await step('PCU dashboard moved by exactly the expected amounts', async () => {
  const after = await api('GET', '/internal/pcu/metrics');
  const b = state.before;
  eq(after.youthEnrolled.value - b.youthEnrolled.value, 1, 'youth enrolled delta');
  eq(after.jobPlacement.completers - b.jobPlacement.completers, 1, 'completers delta');
  eq(after.jobPlacement.placed - b.jobPlacement.placed, 1, 'placed delta');
  const tier = state.course.tier;
  const tierDelta = after.skillTiers.find((t) => t.tier === tier).completed - b.skillTiers.find((t) => t.tier === tier).completed;
  eq(tierDelta, 1, `${tier} tier delta`);
  const coe = (m) => m.perCoe.find((c) => c.institutionId === state.institution.id)?.youthEnrolled ?? 0;
  eq(coe(after) - coe(b), 1, 'per-CoE youth delta');
  eq(after.femaleParticipation.participants - b.femaleParticipation.participants, 1, 'female participants delta');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) console.log('Leftover smoke data (safe to delete): beneficiary', state.referenceId ?? '(not created)', '/ cohort', `SMOKE ${stamp}`);
process.exit(failed ? 1 : 0);
