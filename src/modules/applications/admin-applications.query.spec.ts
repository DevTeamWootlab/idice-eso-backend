import { ApplicationStatus } from '@/common/enums/application.enum';
import {
  ADMIN_LIST_DEFAULT_LIMIT,
  ADMIN_LIST_MAX_LIMIT,
  buildStatusCounts,
  clampPagination,
  escapeLikePattern,
  parseStatusFilter,
  totalPagesFor,
} from './admin-applications.query';

describe('escapeLikePattern', () => {
  it('escapes LIKE wildcards and backslashes so input matches literally', () => {
    expect(escapeLikePattern('50%_off\\')).toBe('50\\%\\_off\\\\');
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeLikePattern('Bright Path Hub')).toBe('Bright Path Hub');
  });
});

describe('parseStatusFilter', () => {
  it('returns empty for missing or blank input', () => {
    expect(parseStatusFilter(undefined)).toEqual({ valid: [], invalid: [] });
    expect(parseStatusFilter('')).toEqual({ valid: [], invalid: [] });
    expect(parseStatusFilter(' , ,')).toEqual({ valid: [], invalid: [] });
  });

  it('parses a comma-separated list, trimming, upper-casing and de-duplicating', () => {
    expect(parseStatusFilter('shortlisted, MATCHED,SHORTLISTED')).toEqual({
      valid: [ApplicationStatus.SHORTLISTED, ApplicationStatus.MATCHED],
      invalid: [],
    });
  });

  it('separates unknown values so the caller can reject them', () => {
    expect(parseStatusFilter('SHORTLISTED,NOPE')).toEqual({
      valid: [ApplicationStatus.SHORTLISTED],
      invalid: ['NOPE'],
    });
  });
});

describe('clampPagination', () => {
  it('applies defaults', () => {
    expect(clampPagination()).toEqual({
      page: 1,
      limit: ADMIN_LIST_DEFAULT_LIMIT,
      skip: 0,
    });
  });

  it('computes skip from page and limit', () => {
    expect(clampPagination(3, 10)).toEqual({ page: 3, limit: 10, skip: 20 });
  });

  it('caps the limit and repairs nonsense values', () => {
    expect(clampPagination(0, 10_000)).toEqual({
      page: 1,
      limit: ADMIN_LIST_MAX_LIMIT,
      skip: 0,
    });
    expect(clampPagination(Number.NaN, -5).page).toBe(1);
    expect(clampPagination(2.9, 5).page).toBe(2);
  });
});

describe('totalPagesFor', () => {
  it('always reports at least one page', () => {
    expect(totalPagesFor(0, 20)).toBe(1);
    expect(totalPagesFor(20, 20)).toBe(1);
    expect(totalPagesFor(21, 20)).toBe(2);
  });
});

describe('buildStatusCounts', () => {
  it('zero-fills every status and excludes DRAFT from the total', () => {
    const stats = buildStatusCounts([
      { status: 'DRAFT', count: '4' },
      { status: 'SUBMITTED', count: '3' },
      { status: 'SHORTLISTED', count: 2 },
    ]);
    expect(stats.drafts).toBe(4);
    expect(stats.total).toBe(5);
    expect(stats.byStatus.SUBMITTED).toBe(3);
    expect(stats.byStatus.SHORTLISTED).toBe(2);
    expect(stats.byStatus.MATCHED).toBe(0);
    expect(Object.keys(stats.byStatus)).toHaveLength(
      Object.values(ApplicationStatus).length,
    );
  });

  it('ignores unknown statuses and non-numeric counts', () => {
    const stats = buildStatusCounts([
      { status: 'LEGACY_STATUS', count: '9' },
      { status: 'REJECTED', count: 'abc' },
    ]);
    expect(stats.total).toBe(0);
  });

  it('returns all zeros for an empty table', () => {
    const stats = buildStatusCounts([]);
    expect(stats.total).toBe(0);
    expect(stats.drafts).toBe(0);
  });
});
