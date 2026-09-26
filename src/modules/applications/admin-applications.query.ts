import { ApplicationStatus } from '@/common/enums/application.enum';

export const ADMIN_LIST_DEFAULT_LIMIT = 20;
export const ADMIN_LIST_MAX_LIMIT = 100;
export const ADMIN_SEARCH_MAX_LENGTH = 100;

/**
 * Columns selected for the SYSADMIN list view. Deliberately excludes the long-text
 * narrative sections and personnel/document relations — the list only needs enough to
 * render a row and the fallback completeness percentage on the frontend.
 */
export const ADMIN_LIST_COLUMNS = [
  'id',
  'applicationRef',
  'status',
  'version',
  'submittedByOrgId',
  'preferredInstitutionId',
  'organisationLegalName',
  'registrationType',
  'yearEstablished',
  'organisationType',
  'primaryContactName',
  'primaryContactPhone',
  'primaryContactEmail',
  'statesOfOperation',
  'physicalAddress',
  'tin',
  'submittedAt',
  'createdAt',
  'updated_at',
  'finalScorePercent',
  'scoreVarianceFlagged',
  'scoringIntegrityError',
] as const;

const ALL_STATUSES = Object.values(ApplicationStatus) as string[];

/** Escapes LIKE/ILIKE wildcards so user input is matched literally. */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function parseStatusFilter(raw?: string | null): {
  valid: ApplicationStatus[];
  invalid: string[];
} {
  if (!raw) return { valid: [], invalid: [] };
  const parts = raw
    .split(',')
    .map((part) => part.trim().toUpperCase())
    .filter((part) => part.length > 0);
  const unique = Array.from(new Set(parts));
  return {
    valid: unique.filter((part) =>
      ALL_STATUSES.includes(part),
    ) as ApplicationStatus[],
    invalid: unique.filter((part) => !ALL_STATUSES.includes(part)),
  };
}

export function clampPagination(
  page?: number,
  limit?: number,
): { page: number; limit: number; skip: number } {
  const safePage =
    Number.isFinite(page) && (page as number) >= 1
      ? Math.floor(page as number)
      : 1;
  const requestedLimit =
    Number.isFinite(limit) && (limit as number) >= 1
      ? Math.floor(limit as number)
      : ADMIN_LIST_DEFAULT_LIMIT;
  const safeLimit = Math.min(requestedLimit, ADMIN_LIST_MAX_LIMIT);
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}

export function totalPagesFor(total: number, limit: number): number {
  return Math.max(1, Math.ceil(total / limit));
}

export interface AdminApplicationStats {
  /** Every application that has left DRAFT. */
  total: number;
  drafts: number;
  byStatus: Record<ApplicationStatus, number>;
}

/**
 * Turns raw GROUP BY rows (Postgres returns COUNT(*) as a string) into a zero-filled
 * per-status map so the frontend never has to guess which stages are missing.
 */
export function buildStatusCounts(
  rows: { status: string; count: string | number }[],
): AdminApplicationStats {
  const byStatus = Object.fromEntries(
    ALL_STATUSES.map((status) => [status, 0]),
  ) as Record<ApplicationStatus, number>;

  for (const row of rows) {
    if (!ALL_STATUSES.includes(row.status)) continue;
    const count = Number(row.count);
    if (!Number.isFinite(count)) continue;
    byStatus[row.status as ApplicationStatus] += count;
  }

  const drafts = byStatus[ApplicationStatus.DRAFT];
  const total =
    Object.values(byStatus).reduce((sum, count) => sum + count, 0) - drafts;
  return { total, drafts, byStatus };
}
