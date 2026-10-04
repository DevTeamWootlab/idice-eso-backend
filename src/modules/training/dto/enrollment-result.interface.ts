export type EnrollmentOutcome =
  | 'ENROLLED'
  | 'ALREADY_ENROLLED'
  | 'BENEFICIARY_NOT_FOUND'
  | 'COHORT_FULL'
  | 'PILLAR_MISMATCH'
  | 'REJECTED';

export interface EnrollmentResultItem {
  beneficiaryId: string;
  outcome: EnrollmentOutcome;
  reason?: string; // optional, only present for non-successful outcomes
}

export interface BulkEnrollmentResult {
  cohortId: string;
  requested: number;
  enrolled: number;
  skipped: number;
  results: EnrollmentResultItem[];
}
