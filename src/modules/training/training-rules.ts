import { BeneficiaryStatus, Pillar } from '@/common/enums/beneficiary.enum';
import { CohortStatus } from '@/common/enums/training.enum';

const C = CohortStatus;

const COHORT_TRANSITIONS: Record<CohortStatus, CohortStatus[]> = {
  [C.PLANNED]: [C.ACTIVE, C.PAUSED, C.CANCELLED],
  [C.ACTIVE]: [C.COMPLETED, C.PAUSED, C.CANCELLED],
  [C.PAUSED]: [C.PLANNED, C.ACTIVE, C.CANCELLED],
  [C.COMPLETED]: [],
  [C.CANCELLED]: [],
};

export function canTransitionCohort(from: CohortStatus, to: CohortStatus) {
  return COHORT_TRANSITIONS[from]?.includes(to) ?? false;
}

export const isOpenForEnrolment = (status: CohortStatus) =>
  status === C.PLANNED || status === C.ACTIVE;

export const canRecordCompletions = (status: CohortStatus) =>
  status === C.ACTIVE || status === C.COMPLETED;

/** Why a beneficiary can't join a cohort, or null when they can. */
export function enrolmentBlocker(
  beneficiary: {
    status: BeneficiaryStatus;
    pillar: Pillar;
    assignedInstitutionId?: string | null;
  },
  cohort: { institutionId: string },
): string | null {
  if (beneficiary.status !== BeneficiaryStatus.ALLOCATED) {
    return 'Beneficiary has not been allocated to a Centre of Excellence';
  }
  if (beneficiary.assignedInstitutionId !== cohort.institutionId) {
    return 'Beneficiary is allocated to a different institution';
  }
  if (beneficiary.pillar !== Pillar.SKILLS) {
    return 'Only Skills-pillar beneficiaries can join a training cohort';
  }
  return null;
}

/** Why a completion record is invalid, or null when it is fine. */
export function completionBlocker(record: {
  completed: boolean;
  certified?: boolean;
  attendanceRate?: number;
}): string | null {
  if (record.certified && !record.completed) {
    return 'A beneficiary cannot be certified without completing the course';
  }
  if (
    record.attendanceRate !== undefined &&
    (record.attendanceRate < 0 || record.attendanceRate > 100)
  ) {
    return 'attendanceRate must be between 0 and 100';
  }
  return null;
}

export const isEditable = (status: CohortStatus) =>
  status === C.PLANNED || status === C.ACTIVE || status === C.PAUSED;
