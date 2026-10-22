import { AcademicStatus, EmploymentStatus } from '@/common/enums/beneficiary.enum';
import { checkAcademicStatus, deriveNeet } from './academic-status';

describe('academic and employment status', () => {
  it('treats only out-of-school unemployed applicants as NEET', () => {
    expect(deriveNeet(AcademicStatus.STUDENT, EmploymentStatus.UNEMPLOYED)).toBe(false);
    expect(deriveNeet(AcademicStatus.RECENT_GRADUATE, EmploymentStatus.UNEMPLOYED)).toBe(true);
    expect(deriveNeet(AcademicStatus.OTHER, EmploymentStatus.UNEMPLOYED)).toBe(true);
    expect(deriveNeet(AcademicStatus.OTHER, EmploymentStatus.SELF_EMPLOYED)).toBe(false);
  });

  it('accepts consistent answers', () => {
    expect(
      checkAcademicStatus({
        academicStatus: AcademicStatus.STUDENT,
        employmentStatus: EmploymentStatus.PART_TIME,
        isCurrentStudent: true,
        isRecentGraduate: false,
        isNeet: false,
      }),
    ).toBeNull();
    expect(
      checkAcademicStatus({
        academicStatus: AcademicStatus.OTHER,
        employmentStatus: EmploymentStatus.UNEMPLOYED,
        isCurrentStudent: false,
        isRecentGraduate: false,
        isNeet: true,
      }),
    ).toBeNull();
  });

  it('rejects a missing employment status, the retired NEET option and mismatched flags', () => {
    const base = { isCurrentStudent: false, isRecentGraduate: false, isNeet: false };
    expect(checkAcademicStatus({ ...base, academicStatus: AcademicStatus.OTHER })).toMatch(/employmentStatus/);
    expect(
      checkAcademicStatus({ ...base, academicStatus: AcademicStatus.NEET, employmentStatus: EmploymentStatus.UNEMPLOYED }),
    ).toMatch(/academicStatus/);
    expect(
      checkAcademicStatus({ ...base, academicStatus: AcademicStatus.OTHER, employmentStatus: EmploymentStatus.UNEMPLOYED }),
    ).toMatch(/do not agree/);
  });
});
