import { SectorFocus } from '@/common/enums/application.enum';
import { computeMci, hubAlignmentScore, proposeMatches, MatchCandidate } from './matching-rules';

const card = (team: number, delivery: number, inst: number) => ({ teamExpertiseScore: team, deliveryTrackRecordScore: delivery, institutionalAlignmentScore: inst });
const candidate = (over: Partial<MatchCandidate> = {}): MatchCandidate => ({
  applicationId: 'a1', institutionId: 'i1', institutionState: 'Kwara', finalScorePercent: 80,
  sectorFocus: [SectorFocus.TECHNOLOGY], scoreCards: [card(4, 4, 5), card(5, 3, 5)], ...over,
});
const inst = (over = {}) => ({ id: 'i1', state: 'KWARA', hubType: 'GAMING', ...over });

describe('computeMci', () => {
  it('is derived from the score cards and sector focus, with no randomness', () => {
    const first = computeMci(candidate(), inst());
    const second = computeMci(candidate(), inst());
    expect(first).toEqual(second);
    // capacity = ((4.5 + 3.5) / 2) / 5 = 80 ; institutional = 5/5 = 100 ; hub (gaming+technology) = 100
    expect(first.capacityAlignment).toBe(80);
    expect(first.institutionalRelationshipScore).toBe(100);
    expect(first.hubAlignmentScore).toBe(100);
    expect(first.matchCompatibilityIndex).toBe(Math.round(100 * 0.4 + 80 * 0.3 + 100 * 0.3));
  });
  it('drops when the underlying scores drop', () => {
    const strong = computeMci(candidate(), inst()).matchCompatibilityIndex;
    const weak = computeMci(candidate({ scoreCards: [card(1, 1, 1), card(1, 1, 1)] }), inst()).matchCompatibilityIndex;
    expect(weak < strong).toBe(true);
  });
  it('scores 0 for capacity and relationship when there are no score cards', () => {
    const mci = computeMci(candidate({ scoreCards: [] }), inst());
    expect(mci.capacityAlignment).toBe(0);
    expect(mci.institutionalRelationshipScore).toBe(0);
  });
});

describe('hubAlignmentScore', () => {
  it('rewards a sector match on specialised hubs and treats standard hubs as neutral', () => {
    expect(hubAlignmentScore([SectorFocus.CREATIVE], 'CREATIVE')).toBe(100);
    expect(hubAlignmentScore([SectorFocus.HYBRID], 'VR')).toBe(75);
    expect(hubAlignmentScore([SectorFocus.CREATIVE], 'GAMING')).toBe(55);
    expect(hubAlignmentScore([], 'STANDARD')).toBe(80);
  });
});

describe('proposeMatches', () => {
  it('picks the highest-MCI proposer per institution within its state', () => {
    const strong = candidate({ applicationId: 'strong' });
    const weak = candidate({ applicationId: 'weak', scoreCards: [card(2, 2, 2)] });
    const [proposal] = proposeMatches([weak, strong], [inst()]);
    expect(proposal.applicationId).toBe('strong');
  });
  it('excludes applicants under the 70% threshold and applicants from another state', () => {
    expect(proposeMatches([candidate({ finalScorePercent: 69.9 })], [inst()])).toEqual([]);
    expect(proposeMatches([candidate({ institutionState: 'Niger' })], [inst()])).toEqual([]);
  });
  it('is deterministic on ties (final score, then application id)', () => {
    const a = candidate({ applicationId: 'b-app' });
    const b = candidate({ applicationId: 'a-app' });
    expect(proposeMatches([a, b], [inst()])[0].applicationId).toBe('a-app');
    expect(proposeMatches([b, a], [inst()])[0].applicationId).toBe('a-app');
  });
  it('gives each institution at most one partner', () => {
    const many = [candidate({ applicationId: 'x' }), candidate({ applicationId: 'y' }), candidate({ applicationId: 'z', institutionId: 'i2', institutionState: 'Niger' })];
    const proposals = proposeMatches(many, [inst(), inst({ id: 'i2', state: 'Niger', hubType: 'STANDARD' })]);
    expect(proposals.map((p) => p.institutionId).sort()).toEqual(['i1', 'i2']);
  });
});
