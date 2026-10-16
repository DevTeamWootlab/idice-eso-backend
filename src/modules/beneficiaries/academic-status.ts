import { AcademicStatus, EmploymentStatus } from '@/common/enums/beneficiary.enum';

export const INTAKE_ACADEMIC_STATUSES: AcademicStatus[] = [
  AcademicStatus.STUDENT,
  AcademicStatus.RECENT_GRADUATE,
  AcademicStatus.OTHER,
];

export function deriveNeet(academicStatus: AcademicStatus, employmentStatus: EmploymentStatus): boolean {
  return academicStatus !== AcademicStatus.STUDENT && employmentStatus === EmploymentStatus.UNEMPLOYED;
}

export function checkAcademicStatus(input: {
  academicStatus: AcademicStatus;
  employmentStatus?: EmploymentStatus | null;
  isCurrentStudent: boolean;
  isRecentGraduate: boolean;
  isNeet: boolean;
}): string | null {
  if (!INTAKE_ACADEMIC_STATUSES.includes(input.academicStatus)) {
    return 'academicStatus must be STUDENT, RECENT_GRADUATE or OTHER';
  }
  if (!input.employmentStatus || !Object.values(EmploymentStatus).includes(input.employmentStatus)) {
    return 'employmentStatus is required';
  }
  const expected = {
    isCurrentStudent: input.academicStatus === AcademicStatus.STUDENT,
    isRecentGraduate: input.academicStatus === AcademicStatus.RECENT_GRADUATE,
    isNeet: deriveNeet(input.academicStatus, input.employmentStatus),
  };
  const mismatch =
    input.isCurrentStudent !== expected.isCurrentStudent ||
    input.isRecentGraduate !== expected.isRecentGraduate ||
    input.isNeet !== expected.isNeet;
  return mismatch
    ? 'isCurrentStudent / isRecentGraduate / isNeet do not agree with academicStatus and employmentStatus'
    : null;
}
