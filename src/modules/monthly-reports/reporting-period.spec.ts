import { deadlineFor, dueDateFor, monthLabel, reportMonthOf, reportStatus } from './reporting-period';

describe('monthly reporting period', () => {
  it('uses the last day of the month as the due date, including leap years', () => {
    expect(dueDateFor('2026-10')).toBe('2026-10-31');
    expect(dueDateFor('2026-11')).toBe('2026-11-30');
    expect(dueDateFor('2026-02')).toBe('2026-02-28');
    expect(dueDateFor('2028-02')).toBe('2028-02-29');
  });

  it('works out the reporting month in Nigeria time', () => {
    expect(reportMonthOf(new Date('2026-10-31T22:30:00Z'))).toBe('2026-10');
    expect(reportMonthOf(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11');
  });

  it('closes at the end of the due day in Nigeria time', () => {
    expect(deadlineFor('2026-10').toISOString()).toBe('2026-10-31T22:59:59.999Z');
  });

  it('marks submissions on time, late, due or overdue', () => {
    expect(reportStatus('2026-10', new Date('2026-10-31T22:00:00Z'))).toBe('ON_TIME');
    expect(reportStatus('2026-10', new Date('2026-11-01T08:00:00Z'))).toBe('LATE');
    expect(reportStatus('2026-10', null, new Date('2026-10-25T12:00:00Z'))).toBe('DUE');
    expect(reportStatus('2026-10', null, new Date('2026-11-01T00:00:00Z'))).toBe('OVERDUE');
  });

  it('names the month in words', () => {
    expect(monthLabel('2026-10')).toBe('October 2026');
  });
});
