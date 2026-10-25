export const REPORT_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const LAGOS_OFFSET_MS = 60 * 60 * 1000;

export type MonthlyReportStatus = 'ON_TIME' | 'LATE' | 'DUE' | 'OVERDUE';

export function reportMonthOf(date: Date): string {
  const local = new Date(date.getTime() + LAGOS_OFFSET_MS);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function dueDateFor(reportMonth: string): string {
  const [year, month] = reportMonth.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${reportMonth}-${String(lastDay).padStart(2, '0')}`;
}

export function deadlineFor(reportMonth: string): Date {
  return new Date(`${dueDateFor(reportMonth)}T23:59:59.999+01:00`);
}

export function monthLabel(reportMonth: string): string {
  const [year, month] = reportMonth.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function reportStatus(reportMonth: string, submittedAt: Date | null, now: Date = new Date()): MonthlyReportStatus {
  const deadline = deadlineFor(reportMonth);
  if (submittedAt) return submittedAt.getTime() <= deadline.getTime() ? 'ON_TIME' : 'LATE';
  return now.getTime() <= deadline.getTime() ? 'DUE' : 'OVERDUE';
}
