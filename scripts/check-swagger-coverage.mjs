#!/usr/bin/env node
/**
 * Fails when the Swagger docs would be incomplete:
 *   - every controller has @ApiTags
 *   - every route has @ApiOperation, an auth annotation (unless @Public) and a documented response
 *   - every property of a request DTO (@Body/@Query) carries an @Api*Property decorator
 *
 * Usage: node scripts/check-swagger-coverage.mjs [--only=<regex on file path>] [--update-baseline]
 *
 * scripts/swagger-baseline.json lists gaps that predate this check; only gaps NOT in it fail the
 * run. Shrink it as routes get documented (--update-baseline rewrites it from the current state).
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname, 'src');
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7);
const updateBaseline = process.argv.includes('--update-baseline');
const baselinePath = path.resolve(new URL('.', import.meta.url).pathname, 'swagger-baseline.json');
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')) files.push(full);
  }
})(root);

const rel = (f) => path.relative(root, f);
const source = new Map(files.map((f) => [f, fs.readFileSync(f, 'utf8')]));
const problems = [];

// Index DTO/entity classes by name so @Body() types can be resolved.
const classes = new Map();
for (const [file, src] of source) {
  for (const m of src.matchAll(/export class (\w+)[^{]*\{/g)) {
    const start = m.index + m[0].length;
    let depth = 1, i = start;
    while (i < src.length && depth > 0) { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; i++; }
    classes.set(m[1], { file, body: src.slice(start, i - 1) });
  }
}

function checkDto(name, origin, seen = new Set()) {
  if (seen.has(name) || !classes.has(name)) return;
  seen.add(name);
  const { file, body } = classes.get(name);
  if (!/Dto$/.test(name) && !file.includes('/dto/')) return;
  // Walk the class body as statements: a property is documented iff the decorator run
  // directly above it (multi-line decorators, blank lines and comments included) has @ApiProperty*.
  let pending = [];
  for (const stmt of statements(body)) {
    if (stmt.deco) { pending.push(stmt.text); continue; }
    const prop = stmt.text.match(/^(?:readonly\s+)?(\w+)[!?]?:\s*[^;]+;?$/);
    if (prop && !/^(constructor|return|throw)\b/.test(stmt.text)) {
      const documented = pending.some((d) => /^@Api(Property|PropertyOptional|HideProperty)\b/.test(d));
      if (!documented) problems.push(`${rel(file)}: ${name}.${prop[1]} has no @ApiProperty (used by ${origin})`);
    }
    pending = [];
  }
}

/** Splits a class body into decorator statements (multi-line aware) and everything else. */
function statements(src) {
  const out = [];
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t.startsWith('@')) { if (t && !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')) out.push({ deco: false, text: t }); continue; }
    let text = t, depth = (t.match(/\(/g) ?? []).length - (t.match(/\)/g) ?? []).length;
    while (depth > 0 && i + 1 < lines.length) { i++; text += ' ' + lines[i].trim(); depth += (lines[i].match(/\(/g) ?? []).length - (lines[i].match(/\)/g) ?? []).length; }
    out.push({ deco: true, text });
  }
  return out;
}

const VERB = /^@(Get|Post|Put|Patch|Delete)\(([^)]*)\)/;
for (const [file, src] of source) {
  if (!file.endsWith('.controller.ts')) continue;
  if (only && !new RegExp(only).test(rel(file))) continue;
  if (!/@Controller\(/.test(src)) continue;
  // Class-level decorators sit around @Controller(...), which may not be the first class in the file.
  const ctrlAt = src.indexOf('@Controller(');
  const headerStart = Math.max(0, src.lastIndexOf('\n}\n', ctrlAt) + 1);
  const header = src.slice(headerStart, src.indexOf('export class', ctrlAt));
  const stmts = statements(src.slice(src.indexOf('@Controller(')));
  const routeCount = stmts.filter((x) => x.deco && VERB.test(x.text)).length;
  if (routeCount === 0) continue;
  if (!/@ApiTags\(/.test(header)) problems.push(`${rel(file)}: controller has no @ApiTags`);
  const classPublic = /@Public\(\)/.test(header);
  const classBearer = /@ApiBearerAuth\(/.test(header);

  for (let i = 0; i < stmts.length; i++) {
    const m = stmts[i].deco && stmts[i].text.match(VERB);
    if (!m) continue;
    let a = i, b = i;
    while (a > 0 && stmts[a - 1].deco) a--;
    while (b + 1 < stmts.length && stmts[b + 1].deco) b++;
    const stack = stmts.slice(a, b + 1).map((x) => x.text);
    const block = stack.join('\n');
    const label = `${rel(file)}: ${m[1].toUpperCase()} ${m[2].replace(/['"]/g, '') || '/'}`;
    const isPublic = classPublic || /@Public\(\)/.test(block);
    if (!/@ApiOperation\(/.test(block)) problems.push(`${label} has no @ApiOperation`);
    if (!isPublic && !classBearer && !/@ApiBearerAuth\(/.test(block)) problems.push(`${label} has no @ApiBearerAuth (and is not @Public)`);
    if (!/@Api\w*Response\(/.test(block)) problems.push(`${label} has no documented response (@ApiOkResponse/@ApiCreatedResponse/...)`);
    const seenDeco = new Set();
    for (const d of stack) { if (/^@Api/.test(d) && seenDeco.has(d)) problems.push(`${label} repeats ${d.slice(0, 60)}`); seenDeco.add(d); }
    for (const p of block.matchAll(/@(?:Body|Query)\([^)]*\)\s+\w+:\s*(\w+)/g)) checkDto(p[1], label);
  }
  // request DTOs appear in the method signature, which follows the decorator stack
  for (const p of src.matchAll(/@(?:Body|Query)\([^)]*\)\s+\w+:\s*(\w+)/g)) checkDto(p[1], rel(file));
}

const unique = [...new Set(problems)].sort();
if (updateBaseline) {
  fs.writeFileSync(baselinePath, JSON.stringify(unique, null, 2) + '\n');
  console.log(`Baseline written with ${unique.length} known gap(s).`);
  process.exit(0);
}
const known = new Set(fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : []);
const fresh = unique.filter((p) => !known.has(p));
const stale = [...known].filter((p) => !unique.includes(p));
if (stale.length) console.log(`(${stale.length} baseline gap(s) are now fixed — run with --update-baseline to drop them.)`);
if (fresh.length === 0) {
  console.log(`Swagger coverage OK${only ? ` (files matching /${only}/)` : ''}; ${unique.length} pre-existing gap(s) remain in the baseline.`);
  process.exit(0);
}
console.log(fresh.join('\n'));
console.log(`\n${fresh.length} new Swagger documentation gap(s).`);
process.exit(1);
