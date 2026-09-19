import { BeneficiaryStatus as S } from '@/common/enums/beneficiary.enum';
import { canTransitionBeneficiary } from './beneficiary-lifecycle';

describe('canTransitionBeneficiary', () => {
  it('allows the normal review path', () => {
    expect(canTransitionBeneficiary(S.SUBMITTED, S.UNDER_REVIEW)).toBe(true);
    expect(canTransitionBeneficiary(S.UNDER_REVIEW, S.SHORTLISTED)).toBe(true);
    expect(canTransitionBeneficiary(S.SHORTLISTED, S.ALLOCATED)).toBe(true);
    expect(canTransitionBeneficiary(S.SUBMITTED, S.ALLOCATED)).toBe(true);
  });
  it('only lets an allocated youth be withdrawn, never silently un-enrolled', () => {
    expect(canTransitionBeneficiary(S.ALLOCATED, S.WITHDRAWN)).toBe(true);
    expect(canTransitionBeneficiary(S.ALLOCATED, S.REJECTED)).toBe(false);
    expect(canTransitionBeneficiary(S.ALLOCATED, S.SUBMITTED)).toBe(false);
  });
  it('lets a rejected application be reopened but keeps withdrawn/draft terminal', () => {
    expect(canTransitionBeneficiary(S.REJECTED, S.UNDER_REVIEW)).toBe(true);
    expect(canTransitionBeneficiary(S.REJECTED, S.ALLOCATED)).toBe(false);
    expect(canTransitionBeneficiary(S.WITHDRAWN, S.UNDER_REVIEW)).toBe(false);
    expect(canTransitionBeneficiary(S.DRAFT, S.SUBMITTED)).toBe(false);
  });
});
