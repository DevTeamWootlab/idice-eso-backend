import { BeneficiaryStatus, Pillar } from '@/common/enums/beneficiary.enum';
import { CohortStatus as C } from '@/common/enums/training.enum';
import {
  canRecordCompletions,
  canTransitionCohort,
  completionBlocker,
  enrolmentBlocker,
  isOpenForEnrolment,
} from './training-rules';

const cohort = { institutionId: 'i1' };
const ok = { status: BeneficiaryStatus.ALLOCATED, pillar: Pillar.SKILLS, assignedInstitutionId: 'i1' };

describe('enrolmentBlocker', () => {
  it('accepts an allocated Skills youth at the cohort’s own CoE', () => {
    expect(enrolmentBlocker(ok, cohort)).toBe(null);
  });
  it('rejects unallocated, wrong-CoE and non-Skills beneficiaries with a reason', () => {
    expect(enrolmentBlocker({ ...ok, status: BeneficiaryStatus.SHORTLISTED }, cohort)).toBe(
      'Beneficiary has not been allocated to a Centre of Excellence',
    );
    expect(enrolmentBlocker({ ...ok, assignedInstitutionId: 'i2' }, cohort)).toBe(
      'Beneficiary is allocated to a different institution',
    );
    expect(enrolmentBlocker({ ...ok, pillar: Pillar.INCUBATION }, cohort)).toBe(
      'Only Skills-pillar beneficiaries can join a training cohort',
    );
  });
});

describe('completionBlocker', () => {
  it('rejects certification without completion and out-of-range attendance', () => {
    expect(completionBlocker({ completed: false, certified: true })).toBe(
      'A beneficiary cannot be certified without completing the course',
    );
    expect(completionBlocker({ completed: true, attendanceRate: 101 })).toBe('attendanceRate must be between 0 and 100');
    expect(completionBlocker({ completed: true, certified: true, attendanceRate: 92.5 })).toBe(null);
    expect(completionBlocker({ completed: false })).toBe(null);
  });
});

describe('cohort lifecycle', () => {
  it('follows PLANNED → ACTIVE → COMPLETED with cancellation before completion', () => {
    expect(canTransitionCohort(C.PLANNED, C.ACTIVE)).toBe(true);
    expect(canTransitionCohort(C.ACTIVE, C.COMPLETED)).toBe(true);
    expect(canTransitionCohort(C.PLANNED, C.COMPLETED)).toBe(false);
    expect(canTransitionCohort(C.COMPLETED, C.ACTIVE)).toBe(false);
    expect(canTransitionCohort(C.CANCELLED, C.PLANNED)).toBe(false);
  });
  it('gates enrolment and completions by status', () => {
    expect(isOpenForEnrolment(C.PLANNED)).toBe(true);
    expect(isOpenForEnrolment(C.COMPLETED)).toBe(false);
    expect(canRecordCompletions(C.ACTIVE)).toBe(true);
    expect(canRecordCompletions(C.PLANNED)).toBe(false);
  });
});
