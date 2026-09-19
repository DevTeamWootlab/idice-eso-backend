#!/usr/bin/env node
/**
 * Deploy gate: proves the API that is actually running has every endpoint this codebase
 * defines. A stale deployment shows up in the portal as red "That couldn't be found" or
 * "Validation failed (uuid is expected)" banners, because an old server either lacks a route
 * (404) or routes a newer static path such as /stats into a `:id` route (400, "uuid").
 *
 *   API_URL=https://staging-api.example/api/v1 ACCESS_TOKEN=<SYSADMIN token> \
 *   node scripts/check-deployed-routes.mjs
 *
 * Read-only: only GET routes without path parameters are probed. Exit code 1 if any is
 * missing or shadowed.
 */
import fs from 'node:fs';
import path from 'node:path';

const API_URL = (process.env.API_URL ?? '').replace(/\/+$/, '');
const TOKEN = process.env.ACCESS_TOKEN ?? '';
if (!/^https?:\/\//.test(API_URL) || !TOKEN) {
  console.error('Set API_URL (…/api/v1) and ACCESS_TOKEN (a SYSADMIN access token).');
  process.exit(2);
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
let missing = 0;
console.log(`Probing ${routes.length} GET routes on ${API_URL}\n`);
for (const route of [...new Set(routes)].sort()) {
  if (SKIP.has(route)) continue;
  let line;
  try {
    const res = await fetch(API_URL + route, { headers: { Authorization: `Bearer ${TOKEN}` }, signal: AbortSignal.timeout(15_000) });
    const body = await res.text();
    const shadowed = res.status === 400 && /uuid is expected/i.test(body);
    if (res.status === 404 || shadowed) {
      missing++;
      const snippet = body.replace(/\s+/g, ' ').slice(0, 140) || '(empty body)';
      // A Nest route-miss says "Cannot GET …". An empty or HTML body usually means a proxy or gateway
      // in front of the API answered instead — a routing problem, not an outdated server.
      const hint = shadowed
        ? 'captured by a :id route — the server is older than this code'
        : /Cannot (GET|POST)/.test(body)
          ? 'the API answered: route does not exist — the server is older than this code'
          : 'not a Nest response — check the proxy / gateway path routing';
      line = `MISSING  ${route}  → ${res.status}\n           ${hint}\n           body: ${snippet}`;
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
