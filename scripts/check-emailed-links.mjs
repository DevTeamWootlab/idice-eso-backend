#!/usr/bin/env node
/**
 * Deploy gate: verifies that the portal at FRONTEND_URL serves every page the API
 * emails links to. Run it after deploying the portal (and in CI against staging):
 *
 *   FRONTEND_URL=https://staging.idice.eso.wootlab.ng node scripts/check-emailed-links.mjs
 *
 * Exit code 1 if any link 404s or the host is unreachable.
 */
const PATHS = ['/verify-email', '/reset-password/confirm'];
const base = (process.argv[2] ?? process.env.FRONTEND_URL ?? '').trim().replace(/\/+$/, '');
if (!/^https?:\/\//.test(base)) {
  console.error('Set FRONTEND_URL (or pass the portal URL as the first argument).');
  process.exit(2);
}
let failed = 0;
for (const path of PATHS) {
  try {
    const res = await fetch(base + path, { redirect: 'follow', signal: AbortSignal.timeout(10_000) });
    const ok = res.status < 400;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${base}${path}  → ${res.status}`);
  } catch (err) {
    failed++;
    console.log(`FAIL  ${base}${path}  → ${err instanceof Error ? err.message : err}`);
  }
}
if (failed) console.error('\nEmailed links are broken for this environment. Deploy the current portal build to that host, or fix FRONTEND_URL.');
process.exit(failed ? 1 : 0);
