import { APPLICANT_VISIBLE_ACTIONS, toApplicantActivity } from './applicant-activity';

const row = (id: string, action: string, at: string) => ({ id, action, createdAt: at });

describe('toApplicantActivity', () => {
  it('shows milestones in applicant wording, newest first', () => {
    const events = toApplicantActivity([
      row('1', 'APPLICATION_SUBMITTED', '2026-09-01T10:00:00Z'),
      row('3', 'SCORE_FINALIZED_SHORTLISTED', '2026-09-20T10:00:00Z'),
      row('2', 'ELIGIBILITY_APPROVED', new Date('2026-09-05T10:00:00Z') as unknown as string),
    ]);
    expect(events.map((e) => e.label)).toEqual(['Shortlisted', 'Passed eligibility review', 'Application submitted']);
    expect(events[1].occurredAt).toBe('2026-09-05T10:00:00.000Z');
  });

  it('never exposes internal actions that would reveal reviewers, scores or unconfirmed matches', () => {
    const internal = ['SCORE_SUBMITTED', 'SCORE_VARIANCE_ESCALATED', 'SCORING_REVIEWER_REASSIGNED', 'PARTNER_MATCH_GENERATED', 'SCORING_WEIGHTS_UPDATED'];
    expect(toApplicantActivity(internal.map((a, i) => row(String(i), a, '2026-09-01T00:00:00Z')))).toEqual([]);
    for (const action of internal) expect(action in APPLICANT_VISIBLE_ACTIONS).toBe(false);
  });

  it('returns only id, label and timestamp — no metadata or actor fields', () => {
    const [event] = toApplicantActivity([{ ...row('1', 'APPLICATION_SUBMITTED', '2026-09-01T00:00:00Z'), actorId: 'secret', metadata: { reviewerIds: ['x'] } } as any]);
    expect(Object.keys(event).sort()).toEqual(['id', 'label', 'occurredAt']);
  });
});
