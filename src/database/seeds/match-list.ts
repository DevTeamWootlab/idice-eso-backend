export type NameMatchKind = 'exact' | 'company-suffix' | 'longer-registered-name';

export interface EsoRecord {
  id: string;
  applicationRef: string;
  organisationLegalName: string | null;
  status: string;
  finalScorePercent: number | null;
  state: string | null;
}

export type EsoResolution =
  | { ok: true; record: EsoRecord; kind: NameMatchKind | 'reference'; others: EsoRecord[] }
  | { ok: false; reason: string; candidates: EsoRecord[] };

const COMPANY_SUFFIXES = new Set(['limited', 'gte', 'plc', 'llc', 'inc', 'nig', 'nigeria', 'ng', 'company', 'co']);

export function normaliseName(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word === 'ltd' ? 'limited' : word))
    .join(' ');
}

export function coreName(value: string | null | undefined): string {
  const words = normaliseName(value).split(' ').filter(Boolean);
  while (words.length > 1 && COMPANY_SUFFIXES.has(words[words.length - 1])) words.pop();
  return words.join(' ');
}

export function resolveEso(
  sheetName: string,
  records: EsoRecord[],
  pairableStatuses: string[],
  reference?: string,
): EsoResolution {
  if (reference) {
    const byRef = records.filter((r) => r.applicationRef.trim().toLowerCase() === reference.trim().toLowerCase());
    if (byRef.length === 1) return { ok: true, record: byRef[0], kind: 'reference', others: [] };
    return { ok: false, reason: `No application has the reference ${reference}.`, candidates: [] };
  }

  const wanted = normaliseName(sheetName);
  const wantedCore = coreName(sheetName);
  const tiers: [NameMatchKind, (r: EsoRecord) => boolean][] = [
    ['exact', (r) => normaliseName(r.organisationLegalName) === wanted],
    ['company-suffix', (r) => coreName(r.organisationLegalName) === wantedCore],
    ['longer-registered-name', (r) => coreName(r.organisationLegalName).startsWith(`${wantedCore} `)],
  ];

  for (const [kind, test] of tiers) {
    const hits = records.filter(test);
    if (hits.length === 0) continue;
    const pairable = hits.filter((r) => pairableStatuses.includes(r.status));
    if (pairable.length === 1) {
      return { ok: true, record: pairable[0], kind, others: hits.filter((r) => r.id !== pairable[0].id) };
    }
    if (hits.length === 1) return { ok: true, record: hits[0], kind, others: [] };
    return {
      ok: false,
      reason: `${hits.length} applications match "${sheetName}". Name the right one with --eso "${sheetName}=APPLICATION_REF".`,
      candidates: hits,
    };
  }

  const firstWord = wantedCore.split(' ')[0] ?? '';
  const nearby = firstWord
    ? records.filter((r) => coreName(r.organisationLegalName).split(' ').includes(firstWord)).slice(0, 5)
    : [];
  return {
    ok: false,
    reason: `No application matches "${sheetName}". Name the right one with --eso "${sheetName}=APPLICATION_REF".`,
    candidates: nearby,
  };
}

export function parseEsoOverrides(args: string[]): Map<string, string> {
  const overrides = new Map<string, string>();
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const value = arg.startsWith('--eso=') ? arg.slice(6) : arg === '--eso' ? args[i + 1] : null;
    if (arg === '--eso') i += 1;
    if (value === null || value === undefined) continue;
    const at = value.lastIndexOf('=');
    if (at <= 0 || at === value.length - 1) {
      throw new Error(`--eso expects "ESO name from the sheet=APPLICATION_REF", got "${value}"`);
    }
    overrides.set(normaliseName(value.slice(0, at)), value.slice(at + 1).trim());
  }
  return overrides;
}

export function argValue(args: string[], name: string): string | undefined {
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith(`--${name}=`)) return args[i].slice(name.length + 3);
    if (args[i] === `--${name}`) return args[i + 1];
  }
  return undefined;
}
