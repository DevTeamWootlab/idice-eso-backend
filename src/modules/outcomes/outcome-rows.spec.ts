import { shapeOutcomeCandidates } from './outcome-rows';

describe('shapeOutcomeCandidates', () => {
  const beneficiaries = [
    { id: 'b1', fullName: 'Ada Obi', referenceId: 'REF-1', assignedInstitution: { id: 'i1', name: 'Alpha' } },
    { id: 'b2', fullName: 'Musa Bello', referenceId: 'REF-2', assignedInstitution: null },
  ];

  it('joins outcome and completion data and leaves un-placed graduates with a null outcome', () => {
    const rows = shapeOutcomeCandidates(
      beneficiaries,
      [{ beneficiaryId: 'b1', outcomeType: 'FREELANCE', employerOrVentureName: 'Acme', achievedOn: new Date('2026-11-20T00:00:00Z'), verified: true }],
      [{ beneficiaryId: 'b1', completedAt: new Date('2026-10-30T09:00:00Z') }, { beneficiaryId: 'b2', completedAt: '2026-10-31T09:00:00Z' }],
    );
    expect(rows[0].outcome).toEqual({ outcomeType: 'FREELANCE', employerOrVentureName: 'Acme', achievedOn: '2026-11-20', verified: true });
    expect(rows[0].institution).toEqual({ id: 'i1', name: 'Alpha' });
    expect(rows[0].completedAt).toBe('2026-10-30T09:00:00.000Z');
    expect(rows[1].outcome).toBe(null);
    expect(rows[1].institution).toBe(null);
    expect(rows[1].completedAt).toBe('2026-10-31T09:00:00.000Z');
  });

  it('keeps date-only strings as they are and tolerates missing completion rows', () => {
    const rows = shapeOutcomeCandidates(
      [beneficiaries[0]],
      [{ beneficiaryId: 'b1', outcomeType: 'REMOTE_WORK', achievedOn: '2026-12-01', verified: false }],
      [],
    );
    expect(rows[0].outcome?.achievedOn).toBe('2026-12-01');
    expect(rows[0].outcome?.employerOrVentureName).toBe(null);
    expect(rows[0].completedAt).toBe(null);
  });
});
