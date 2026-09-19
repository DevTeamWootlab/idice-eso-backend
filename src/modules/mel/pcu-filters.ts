import type { InstitutionRow } from './pcu-metrics';

export type Regulator = 'NUC' | 'NBTE' | 'OTHER';

export interface PcuFilters {
  state?: string;
  institutionId?: string;
  cohortId?: string;
  /** ISO date (inclusive) */
  from?: string;
  /** ISO date (inclusive) */
  to?: string;
  regulator?: 'NUC' | 'NBTE';
}

/**
 * Which statutory body a Centre of Excellence reports to, judged from its name:
 * polytechnics report to NBTE, universities to NUC. Anything else is OTHER and appears
 * only in the programme-wide (PCU) report.
 */
export function classifyRegulator(name: string): Regulator {
  const n = name.toLowerCase();
  if (/polytechnic|\bpoly\b|monotechnic|technical college/.test(n)) return 'NBTE';
  if (/universit/.test(n)) return 'NUC';
  return 'OTHER';
}

export function hasInstitutionScope(f: PcuFilters): boolean {
  return Boolean(f.state || f.institutionId || f.regulator);
}

export function filterInstitutions(all: InstitutionRow[], f: PcuFilters): InstitutionRow[] {
  const state = f.state?.trim().toUpperCase();
  return all.filter(
    (i) =>
      (!state || i.state.trim().toUpperCase() === state) &&
      (!f.institutionId || i.id === f.institutionId) &&
      (!f.regulator || classifyRegulator(i.name) === f.regulator),
  );
}

/** Exclusive upper bound for an inclusive `to` date (a bare date covers the whole day). */
export function exclusiveEnd(to: string): Date {
  const end = new Date(to);
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) end.setUTCDate(end.getUTCDate() + 1);
  return end;
}
