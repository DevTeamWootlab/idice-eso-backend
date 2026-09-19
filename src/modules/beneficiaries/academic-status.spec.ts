import { AcademicStatus } from '@/common/enums/beneficiary.enum';
import { checkAcademicStatus } from './academic-status';

const flags = (student: boolean, graduate: boolean, neet: boolean) => ({ isCurrentStudent: student, isRecentGraduate: graduate, isNeet: neet });

describe('checkAcademicStatus', () => {
  it('accepts each status with matching flags', () => {
    expect(checkAcademicStatus({ academicStatus: AcademicStatus.STUDENT, ...flags(true, false, false) })).toBe(null);
    expect(checkAcademicStatus({ academicStatus: AcademicStatus.RECENT_GRADUATE, ...flags(false, true, false) })).toBe(null);
    expect(checkAcademicStatus({ academicStatus: AcademicStatus.NEET, ...flags(false, false, true) })).toBe(null);
    expect(checkAcademicStatus({ academicStatus: AcademicStatus.OTHER, ...flags(false, false, false) })).toBe(null);
  });
  it('rejects a status that contradicts the flags', () => {
    expect(checkAcademicStatus({ academicStatus: AcademicStatus.STUDENT, ...flags(false, false, false) })).toContain('does not match');
    expect(checkAcademicStatus({ academicStatus: AcademicStatus.OTHER, ...flags(true, false, false) })).toContain('does not match');
    expect(checkAcademicStatus({ academicStatus: AcademicStatus.NEET, ...flags(false, true, true) })).toContain('does not match');
  });
  it('rejects a missing status', () => {
    expect(checkAcademicStatus({ academicStatus: undefined as unknown as AcademicStatus, ...flags(false, false, false) })).toContain('required');
  });
});
