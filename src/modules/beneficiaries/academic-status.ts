import { AcademicStatus, EmploymentStatus } from '@/common/enums/beneficiary.enum';

export const INTAKE_ACADEMIC_STATUSES: AcademicStatus[] = [
  AcademicStatus.STUDENT,
  AcademicStatus.RECENT_GRADUATE,
  AcademicStatus.NEET,
];

export const INTAKE_EMPLOYMENT_STATUSES: EmploymentStatus[] = [
  EmploymentStatus.EMPLOYED,
  EmploymentStatus.SELF_EMPLOYED,
  EmploymentStatus.UNEMPLOYED,
];

export function checkAcademicStatus(input: {
  academicStatus: AcademicStatus;
  employmentStatus?: EmploymentStatus | null;
  isCurrentStudent: boolean;
  isRecentGraduate: boolean;
  isNeet: boolean;
}): string | null {
  if (!INTAKE_ACADEMIC_STATUSES.includes(input.academicStatus)) {
    return 'academicStatus must be STUDENT, RECENT_GRADUATE or NEET';
  }
  if (!input.employmentStatus || !INTAKE_EMPLOYMENT_STATUSES.includes(input.employmentStatus)) {
    return 'employmentStatus must be EMPLOYED, SELF_EMPLOYED or UNEMPLOYED';
  }
  if (input.academicStatus === AcademicStatus.NEET && input.employmentStatus !== EmploymentStatus.UNEMPLOYED) {
    return 'An applicant who is not in education, employment or training (NEET) must choose Unemployed as their employment status';
  }
  const mismatch =
    input.isCurrentStudent !== (input.academicStatus === AcademicStatus.STUDENT) ||
    input.isRecentGraduate !== (input.academicStatus === AcademicStatus.RECENT_GRADUATE) ||
    input.isNeet !== (input.academicStatus === AcademicStatus.NEET);
  return mismatch ? 'isCurrentStudent / isRecentGraduate / isNeet do not agree with academicStatus' : null;
}
