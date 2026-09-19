import { AcademicStatus } from '@/common/enums/beneficiary.enum';

/**
 * The applicant's academic / employment status is compulsory, and the three legacy flags
 * must agree with it (OTHER = none of them). Null when consistent.
 */
export function checkAcademicStatus(input: {
  academicStatus: AcademicStatus;
  isCurrentStudent: boolean;
  isRecentGraduate: boolean;
  isNeet: boolean;
}): string | null {
  const expected = {
    [AcademicStatus.STUDENT]: { isCurrentStudent: true, isRecentGraduate: false, isNeet: false },
    [AcademicStatus.RECENT_GRADUATE]: { isCurrentStudent: false, isRecentGraduate: true, isNeet: false },
    [AcademicStatus.NEET]: { isCurrentStudent: false, isRecentGraduate: false, isNeet: true },
    [AcademicStatus.OTHER]: { isCurrentStudent: false, isRecentGraduate: false, isNeet: false },
  }[input.academicStatus];
  if (!expected) return 'academicStatus is required';
  const mismatch =
    input.isCurrentStudent !== expected.isCurrentStudent ||
    input.isRecentGraduate !== expected.isRecentGraduate ||
    input.isNeet !== expected.isNeet;
  return mismatch ? 'academicStatus does not match the isCurrentStudent / isRecentGraduate / isNeet answers' : null;
}
