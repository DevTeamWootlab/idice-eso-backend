import { BeneficiaryStatus } from '@/common/enums/beneficiary.enum';

const S = BeneficiaryStatus;

/**
 * Review pipeline for a public-intake beneficiary. ALLOCATED is the point at which a
 * youth counts as enrolled in a Centre of Excellence (it drives the PCU dashboard),
 * so it can only be reached deliberately and only left by withdrawal.
 */
const TRANSITIONS: Record<BeneficiaryStatus, BeneficiaryStatus[]> = {
  [S.DRAFT]: [],
  [S.SUBMITTED]: [S.UNDER_REVIEW, S.SHORTLISTED, S.ALLOCATED, S.REJECTED, S.WITHDRAWN],
  [S.UNDER_REVIEW]: [S.SHORTLISTED, S.ALLOCATED, S.REJECTED, S.WITHDRAWN],
  [S.SHORTLISTED]: [S.ALLOCATED, S.REJECTED, S.WITHDRAWN],
  [S.ALLOCATED]: [S.WITHDRAWN],
  [S.REJECTED]: [S.UNDER_REVIEW],
  [S.WITHDRAWN]: [],
};

export function canTransitionBeneficiary(
  from: BeneficiaryStatus,
  to: BeneficiaryStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export const ADMIN_SETTABLE_BENEFICIARY_STATUSES = [
  S.UNDER_REVIEW,
  S.SHORTLISTED,
  S.ALLOCATED,
  S.REJECTED,
  S.WITHDRAWN,
];
