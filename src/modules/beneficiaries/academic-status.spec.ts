import { AcademicStatus, EmploymentStatus } from '@/common/enums/beneficiary.enum';
import { checkAcademicStatus } from './academic-status';

const base = { isCurrentStudent: false, isRecentGraduate: false, isNeet: false };

describe('academic status', () => {
  it('accepts a student who is employed', () => {
    expect(
      checkAcademicStatus({ ...base, isCurrentStudent: true, academicStatus: AcademicStatus.STUDENT, employmentStatus: EmploymentStatus.EMPLOYED }),
    ).toBeNull();
  });

  it('accepts a recent graduate who is self-employed', () => {
    expect(
      checkAcademicStatus({ ...base, isRecentGraduate: true, academicStatus: AcademicStatus.RECENT_GRADUATE, employmentStatus: EmploymentStatus.SELF_EMPLOYED }),
    ).toBeNull();
  });

  it('accepts a NEET applicant who is unemployed', () => {
    expect(
      checkAcademicStatus({ ...base, isNeet: true, academicStatus: AcademicStatus.NEET, employmentStatus: EmploymentStatus.UNEMPLOYED }),
    ).toBeNull();
  });

  it('rejects NEET with a job', () => {
    expect(
      checkAcademicStatus({ ...base, isNeet: true, academicStatus: AcademicStatus.NEET, employmentStatus: EmploymentStatus.EMPLOYED }),
    ).toMatch(/must choose Unemployed/);
  });

  it('rejects the retired OTHER status and old employment values', () => {
    expect(checkAcademicStatus({ ...base, academicStatus: AcademicStatus.OTHER, employmentStatus: EmploymentStatus.UNEMPLOYED })).toMatch(/STUDENT, RECENT_GRADUATE or NEET/);
    expect(
      checkAcademicStatus({ ...base, isCurrentStudent: true, academicStatus: AcademicStatus.STUDENT, employmentStatus: EmploymentStatus.FULL_TIME }),
    ).toMatch(/EMPLOYED, SELF_EMPLOYED or UNEMPLOYED/);
  });

  it('rejects flags that disagree with the status', () => {
    expect(
      checkAcademicStatus({ ...base, academicStatus: AcademicStatus.STUDENT, employmentStatus: EmploymentStatus.UNEMPLOYED }),
    ).toMatch(/do not agree/);
  });
});
