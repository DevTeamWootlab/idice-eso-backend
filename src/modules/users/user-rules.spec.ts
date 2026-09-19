import { planScoringSlot, validateReassignSlot, validateReviewerPair, validateUserUpdate } from './user-rules';

describe('planScoringSlot', () => {
  it('gives the first free slot when none is requested', () => {
    expect(planScoringSlot([])).toEqual({ slot: 1 });
    expect(planScoringSlot([{ id: 'a', scoringSlot: 1 }])).toEqual({ slot: 2 });
    expect(planScoringSlot([{ id: 'a', scoringSlot: 2 }])).toEqual({ slot: 1 });
  });
  it('caps active scoring reviewers at two', () => {
    const result = planScoringSlot([{ id: 'a', scoringSlot: 1 }, { id: 'b', scoringSlot: 2 }]);
    expect('error' in result && result.error).toContain('Only two Scoring Reviewers');
  });
  it('refuses a slot another active reviewer already holds, and invalid slots', () => {
    const held = planScoringSlot([{ id: 'a', scoringSlot: 1 }], 1);
    expect('error' in held && held.error).toContain('Reviewer 1 is already held');
    const bad = planScoringSlot([], 3);
    expect('error' in bad && bad.error).toContain('1 or 2');
  });
  it("lets a reviewer keep or change their own slot without counting against themselves", () => {
    const rows = [{ id: 'a', scoringSlot: 1 }, { id: 'b', scoringSlot: 2 }];
    expect(planScoringSlot(rows, 1, 'a')).toEqual({ slot: 1 });
    const swap = planScoringSlot(rows, 2, 'a');
    expect('error' in swap).toBe(true);
  });
  it('counts a legacy reviewer with no slot toward the cap but leaves both slots free', () => {
    expect(planScoringSlot([{ id: 'legacy', scoringSlot: null }])).toEqual({ slot: 1 });
  });
});

describe('validateReviewerPair', () => {
  const r = (id: string, slot: number | null, over = {}) => ({ id, email: `${id}@x.ng`, role: 'ROLE_SCORING_REVIEWER', isActive: true, scoringSlot: slot, ...over });
  it('accepts one Reviewer 1 and one Reviewer 2', () => {
    expect(validateReviewerPair(['a', 'b'], [r('a', 1), r('b', 2)])).toBe(null);
  });
  it('requires exactly two distinct people', () => {
    expect(validateReviewerPair(['a'], [r('a', 1)])).toContain('Exactly two');
    expect(validateReviewerPair(['a', 'a'], [r('a', 1)])).toContain('different people');
    expect(validateReviewerPair(['a', 'b', 'c'], [])).toContain('Exactly two');
  });
  it('rejects wrong role, inactive accounts, missing slots and duplicate slots', () => {
    expect(validateReviewerPair(['a', 'b'], [r('a', 1), r('b', 2, { role: 'ROLE_VALIDATOR' })])).toContain('Scoring Reviewer role');
    expect(validateReviewerPair(['a', 'b'], [r('a', 1), r('b', 2, { isActive: false })])).toContain('not an active');
    expect(validateReviewerPair(['a', 'b'], [r('a', 1), r('b', null)])).toContain('no reviewer slot');
    expect(validateReviewerPair(['a', 'b'], [r('a', 1), r('b', 1)])).toContain('different slots');
    expect(validateReviewerPair(['a', 'zzz'], [r('a', 1)])).toContain('not found');
  });
});

describe('validateUserUpdate', () => {
  const base = { actorId: 'admin', target: { id: 'u1', role: 'ROLE_VALIDATOR', isActive: true, assignedState: 'KWARA' }, activeAdminCount: 2, pendingScoringAssignments: 0 };
  it('allows renaming and moving a validator to another state', () => {
    expect(validateUserUpdate({ ...base, newAssignedState: 'NIGER' })).toBe(null);
  });
  it('requires a state whenever the result is a validator', () => {
    expect(validateUserUpdate({ ...base, newAssignedState: null })).toContain('assigned state');
    expect(validateUserUpdate({ ...base, target: { ...base.target, role: 'ROLE_SCORING_REVIEWER', assignedState: null }, newRole: 'ROLE_VALIDATOR' })).toContain('assigned state');
  });
  it("blocks changing your own role and demoting the last administrator", () => {
    expect(validateUserUpdate({ ...base, actorId: 'u1', newRole: 'ROLE_SYSADMIN' })).toContain('own role');
    const admin = { ...base.target, role: 'ROLE_SYSADMIN', assignedState: null };
    expect(validateUserUpdate({ ...base, target: admin, newRole: 'ROLE_VALIDATOR', newAssignedState: 'KWARA', activeAdminCount: 1 })).toContain('last active administrator');
  });
  it('blocks moving a reviewer out of the role while they hold unscored work', () => {
    const reviewer = { ...base.target, role: 'ROLE_SCORING_REVIEWER', assignedState: null };
    expect(validateUserUpdate({ ...base, target: reviewer, newRole: 'ROLE_SYSADMIN', pendingScoringAssignments: 2 })).toContain('2 unscored');
  });
  it('rejects applicant accounts and unknown roles', () => {
    expect(validateUserUpdate({ ...base, target: { ...base.target, role: 'ROLE_ESO' } })).toContain('cannot be edited');
    expect(validateUserUpdate({ ...base, newRole: 'ROLE_ESO' })).toContain('internal roles');
  });
});

describe('validateReassignSlot', () => {
  it('requires the replacement to hold the same slot', () => {
    expect(validateReassignSlot(1, 1)).toBe(null);
    expect(validateReassignSlot(1, 2)).toContain('same slot');
    expect(validateReassignSlot(null, 2)).toBe(null);
    expect(validateReassignSlot(1, null)).toContain('no reviewer slot');
  });
});
