#!/usr/bin/env node
/**
 * Deploy gate: proves the API that is actually running has every endpoint this codebase
 * defines. A stale deployment shows up in the portal as red "That couldn't be found" or
 * "Validation failed (uuid is expected)" banners, because an old server either lacks a route
 * (404) or routes a newer static path such as /stats into a `:id` route (400, "uuid").
 *
 *   API_URL=https://staging-api.example/api/v1 SYSADMIN_SEED_PASSWORD=<password> \
 *   node scripts/check-deployed-routes.mjs
 *
 * Read-only except for signing in to obtain a short-lived access token. Only GET routes
 * without path parameters are probed. Exit code 1 if a smoke test or route check fails.
 */
import fs from 'node:fs';
import path from 'node:path';

const API_URL = (process.env.API_URL ?? '').replace(/\/+$/, '');
if (!/^https:\/\//.test(API_URL)) {
  console.error('Set API_URL to the deployed HTTPS API base (…/api/v1).');
  process.exit(2);
}

async function getAccessToken() {
  if (process.env.ACCESS_TOKEN) return process.env.ACCESS_TOKEN;
  if (!process.env.SYSADMIN_SEED_PASSWORD) {
    throw new Error('Set ACCESS_TOKEN or SYSADMIN_SEED_PASSWORD to validate protected routes.');
  }

  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: process.env.SYSADMIN_SEED_EMAIL || 'admin@idice.eso.wootlab.ng',
      password: process.env.SYSADMIN_SEED_PASSWORD,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({}));
  const token = body.data?.accessToken;
  if (!response.ok || !token) {
    throw new Error(`Could not obtain route-check access token (HTTP ${response.status}).`);
  }
  return token;
}

const root = path.resolve(new URL('..', import.meta.url).pathname, 'src');
const controllers = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith('.controller.ts')) controllers.push(full);
  }
})(root);

const routes = [];
for (const file of controllers) {
  const src = fs.readFileSync(file, 'utf8');
  const base = src.match(/@Controller\(\s*['"]([^'"]*)['"]/)?.[1];
  if (base === undefined) continue;
  for (const m of src.matchAll(/@Get\(\s*(?:['"]([^'"]*)['"])?\s*\)/g)) {
    const sub = m[1] ?? '';
    if (sub.includes(':') || base.includes(':')) continue;
    routes.push('/' + [base, sub].filter(Boolean).join('/').replace(/\/+/g, '/'));
  }
}

// Endpoints that legitimately return non-2xx for a plain probe (redirects, needs a query).
const SKIP = new Set(['/auth/verify-email', '/pcu/export', '/internal/pcu/export']);
const TOKEN = await getAccessToken();
const headers = { Authorization: `Bearer ${TOKEN}` };
let missing = 0;

async function checkSmokeEndpoint(route, validate) {
  const response = await fetch(`${API_URL}${route}`, {
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = {};
  }
  if (!response.ok || !validate(body)) {
    const snippet = text.replace(/\s+/g, ' ').slice(0, 140) || '(empty body)';
    throw new Error(`${route} smoke test failed (HTTP ${response.status}): ${snippet}`);
  }
  console.log(`smoke    ${route}  → ${response.status}`);
}

const isReady = (body) =>
  body.data?.status === 'UP' &&
  body.data?.database_connected === true &&
  body.data?.migrations_pending === false &&
  (!process.env.EXPECTED_APP_VERSION ||
    body.data?.version === process.env.EXPECTED_APP_VERSION);

await checkSmokeEndpoint(
  '/health',
  isReady,
);
await checkSmokeEndpoint('/health/ready', isReady);
await checkSmokeEndpoint('/institutions/public', (body) => Array.isArray(body.data));

console.log(`Probing ${routes.length} GET routes on ${API_URL}\n`);
for (const route of [...new Set(routes)].sort()) {
  if (SKIP.has(route)) continue;
  let line;
  try {
    const res = await fetch(API_URL + route, { headers, signal: AbortSignal.timeout(15_000) });
    const body = await res.text();
    const shadowed = res.status === 400 && /uuid is expected/i.test(body);
    if (res.status === 404 || res.status >= 500 || shadowed) {
      missing++;
      const snippet = body.replace(/\s+/g, ' ').slice(0, 140) || '(empty body)';
      // A Nest route-miss says "Cannot GET …". An empty or HTML body usually means a proxy or gateway
      // in front of the API answered instead — a routing problem, not an outdated server.
      const hint = shadowed
        ? 'captured by a :id route — the server is older than this code'
        : /Cannot (GET|POST)/.test(body)
          ? 'the API answered: route does not exist — the server is older than this code'
          : 'not a Nest response — check the proxy / gateway path routing';
      line = `FAILED   ${route}  → ${res.status}\n           ${hint}\n           body: ${snippet}`;
    } else {
      line = `ok       ${route}  → ${res.status}`;
    }
  } catch (err) {
    missing++;
    line = `ERROR    ${route}  → ${err instanceof Error ? err.message : err}`;
  }
  console.log(line);
}
console.log(missing ? `\n${missing} route(s) missing on the deployed API. Redeploy the backend from this code.` : '\nEvery route this code defines is present on the deployed API.');
process.exit(missing ? 1 : 0);
