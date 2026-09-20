export const MAX_SCORING_REVIEWERS = 2;
export const SCORING_SLOTS = [1, 2] as const;

export interface SlotHolder {
  id: string;
  scoringSlot: number | null;
}

export function planScoringSlot(
  activeReviewers: SlotHolder[],
  requested?: number | null,
  selfId?: string,
): { slot: number } | { error: string } {
  const others = activeReviewers.filter((r) => r.id !== selfId);
  if (others.length >= MAX_SCORING_REVIEWERS) {
    return {
      error:
        'Only two Scoring Reviewers can be active (Reviewer 1 and Reviewer 2). Suspend or change the role of an existing Scoring Reviewer first.',
    };
  }
  const taken = new Set(others.map((r) => r.scoringSlot).filter((s): s is number => s !== null));
  if (requested !== undefined && requested !== null) {
    if (!(SCORING_SLOTS as readonly number[]).includes(requested)) {
      return { error: 'Reviewer slot must be 1 or 2.' };
    }
    if (taken.has(requested)) {
      return { error: `Reviewer ${requested} is already held by another active Scoring Reviewer.` };
    }
    return { slot: requested };
  }
  const free = SCORING_SLOTS.find((s) => !taken.has(s));
  return free ? { slot: free } : { error: 'No reviewer slot is free.' };
}

export interface PairReviewer {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  scoringSlot: number | null;
}


export function validateReviewerPair(ids: string[], reviewers: PairReviewer[]): string | null {
  if (ids.length !== 2) return 'Exactly two scoring reviewers (Reviewer 1 and Reviewer 2) are required';
  if (ids[0] === ids[1]) return 'The two scoring reviewers must be different people';
  const picked: PairReviewer[] = [];
  for (const id of ids) {
    const reviewer = reviewers.find((r) => r.id === id);
    if (!reviewer) return `Reviewer ${id} not found`;
    if (reviewer.role !== 'ROLE_SCORING_REVIEWER') return `User ${reviewer.email} does not hold the Scoring Reviewer role`;
    if (!reviewer.isActive) return `User ${reviewer.email} is not an active account`;
    if (reviewer.scoringSlot === null || reviewer.scoringSlot === undefined) {
      return `${reviewer.email} has no reviewer slot — open Users & Roles and set them as Reviewer 1 or Reviewer 2`;
    }
    picked.push(reviewer);
  }
  if (picked[0].scoringSlot === picked[1].scoringSlot) {
    return 'The two reviewers must hold different slots (one Reviewer 1 and one Reviewer 2)';
  }
  return null;
}

export const INTERNAL_ROLE_VALUES = [
  'ROLE_ELIGIBILITY_REVIEWER',
  'ROLE_SCORING_REVIEWER',
  'ROLE_VALIDATOR',
  'ROLE_SYSADMIN',
];

export interface UserUpdateCheck {
  actorId: string;
  target: { id: string; role: string; isActive: boolean; assignedState: string | null };
  newRole?: string;
  newAssignedState?: string | null;
  activeAdminCount: number;
  pendingScoringAssignments: number;
}


export function validateUserUpdate(check: UserUpdateCheck): string | null {
  const { target, newRole } = check;
  if (target.role === 'ROLE_ESO') return 'Applicant accounts cannot be edited here';
  if (newRole !== undefined && !INTERNAL_ROLE_VALUES.includes(newRole)) {
    return 'Role must be one of the internal roles';
  }
  const roleChanges = newRole !== undefined && newRole !== target.role;
  if (roleChanges && check.actorId === target.id) return "You can't change your own role";
  if (roleChanges && target.role === 'ROLE_SYSADMIN' && target.isActive && check.activeAdminCount <= 1) {
    return 'This is the last active administrator — assign another administrator first';
  }
  if (roleChanges && target.role === 'ROLE_SCORING_REVIEWER' && check.pendingScoringAssignments > 0) {
    return `This reviewer still has ${check.pendingScoringAssignments} unscored assignment(s) — reassign them before changing the role`;
  }
  const finalRole = newRole ?? target.role;
  const finalState = check.newAssignedState !== undefined ? check.newAssignedState : target.assignedState;
  if (finalRole === 'ROLE_VALIDATOR' && !finalState) return 'A validator must have an assigned state';
  return null;
}

export function validateReassignSlot(outgoingSlot: number | null, incomingSlot: number | null): string | null {
  if (incomingSlot === null || incomingSlot === undefined) {
    return 'The incoming reviewer has no reviewer slot — open Users & Roles and set them as Reviewer 1 or Reviewer 2';
  }
  if (outgoingSlot !== null && outgoingSlot !== undefined && outgoingSlot !== incomingSlot) {
    return `The incoming reviewer must hold the same slot as the reviewer being replaced (Reviewer ${outgoingSlot})`;
  }
  return null;
}