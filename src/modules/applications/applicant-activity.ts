export interface ApplicantActivityEvent {
  id: string;
  label: string;
  occurredAt: string;
}

/**
 * The only audit actions an applicant is allowed to see, in applicant-safe wording.
 * Anything not listed here is internal and is never returned: score submissions,
 * reviewer (re)assignments, score-variance escalations and draft match generation
 * would reveal who reviewed the application, how reviewers scored it, or a match
 * that has not been confirmed.
 */
export const APPLICANT_VISIBLE_ACTIONS: Record<string, string> = {
  APPLICATION_SUBMITTED: 'Application submitted',
  ELIGIBILITY_APPROVED: 'Passed eligibility review',
  ELIGIBILITY_REWORK_REQUESTED: 'Changes requested to your application',
  ELIGIBILITY_REJECTED: 'Not successful at the eligibility stage',
  SCORING_REVIEWERS_ASSIGNED: 'Scoring review started',
  SCORE_FINALIZED_SHORTLISTED: 'Shortlisted',
  SCORE_FINALIZED_REJECTED: 'Not successful at the scoring stage',
  FIELD_VALIDATION_SUBMITTED: 'Field validation completed',
  PARTNER_MATCH_COMMITTED: 'Matched with a host institution',
};

export function toApplicantActivity(
  rows: { id: string; action: string; createdAt: Date | string }[],
): ApplicantActivityEvent[] {
  return rows
    .filter((row) => row.action in APPLICANT_VISIBLE_ACTIONS)
    .map((row) => ({
      id: row.id,
      label: APPLICANT_VISIBLE_ACTIONS[row.action],
      occurredAt: new Date(row.createdAt).toISOString(),
    }))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
