import { SectorFocus } from '@/common/enums/application.enum';

/** PRD 8.3 — composite technical score needed to enter the matching pool. */
export const QUALIFICATION_THRESHOLD = 70.0;

/**
 * MCI weighting. The PRD names three factors (hub alignment, capacity, institutional
 * relationships) without exact weights; hub alignment leads because it is the one factor
 * unique to this stage. Every input is derived from the application's own data — there is
 * no random component anywhere.
 */
export const MCI_WEIGHTS = { hubAlignment: 0.4, capacity: 0.3, institutionalRelationship: 0.3 };

export type MatchHubType = 'STANDARD' | 'GAMING' | 'VR' | 'CREATIVE';

export interface MciScoreCard {
  teamExpertiseScore?: number | null;
  deliveryTrackRecordScore?: number | null;
  institutionalAlignmentScore?: number | null;
}

export interface MatchCandidate {
  applicationId: string;
  institutionId: string;
  institutionState: string;
  finalScorePercent: number | null;
  sectorFocus: string[];
  scoreCards: MciScoreCard[];
}

export interface MatchInstitution {
  id: string;
  state: string;
  hubType: string;
}

export interface MciBreakdown {
  matchCompatibilityIndex: number;
  hubAlignmentScore: number;
  capacityAlignment: number;
  institutionalRelationshipScore: number;
}

/** How well the ESO's stated sector focus lines up with the hub it applied to. */
export function hubAlignmentScore(sectorFocus: string[], hubType: string): number {
  const has = (focus: SectorFocus) => sectorFocus.includes(focus);
  switch (hubType as MatchHubType) {
    case 'CREATIVE':
      return has(SectorFocus.CREATIVE) ? 100 : has(SectorFocus.HYBRID) ? 75 : 55;
    case 'GAMING':
    case 'VR':
      return has(SectorFocus.TECHNOLOGY) ? 100 : has(SectorFocus.HYBRID) ? 75 : 55;
    default:
      return 80;
  }
}

const average = (values: (number | null | undefined)[]): number => {
  const present = values.filter((v): v is number => v !== null && v !== undefined);
  return present.length === 0 ? 0 : present.reduce((a, b) => a + b, 0) / present.length;
};

/**
 * Capacity = mean of the two reviewers' "Team expertise" and "Delivery track record"
 * scores; institutional relationship = mean "Institutional alignment"; hub alignment from
 * sector focus vs hub type. All scaled to 0–100.
 */
export function computeMci(candidate: MatchCandidate, institution: MatchInstitution): MciBreakdown {
  const cards = candidate.scoreCards ?? [];
  const capacityRaw =
    (average(cards.map((c) => c.teamExpertiseScore)) +
      average(cards.map((c) => c.deliveryTrackRecordScore))) /
    2;
  const institutionalRaw = average(cards.map((c) => c.institutionalAlignmentScore));

  const capacityAlignment = Math.round((capacityRaw / 5) * 100);
  const institutionalRelationshipScore = Math.round((institutionalRaw / 5) * 100);
  const hubScore = hubAlignmentScore(candidate.sectorFocus ?? [], institution.hubType);

  return {
    matchCompatibilityIndex: Math.round(
      hubScore * MCI_WEIGHTS.hubAlignment +
        capacityAlignment * MCI_WEIGHTS.capacity +
        institutionalRelationshipScore * MCI_WEIGHTS.institutionalRelationship,
    ),
    hubAlignmentScore: hubScore,
    capacityAlignment,
    institutionalRelationshipScore,
  };
}

export interface ProposedMatch extends MciBreakdown {
  institutionId: string;
  applicationId: string;
}

/**
 * One ESO partner per open institution, strictly within the institution's state
 * (E_loc = I_loc). Every application targets exactly one Centre of Excellence, so this is
 * the single-round degenerate case of Gale-Shapley: the institution keeps its highest-MCI
 * proposer (ties broken by final score, then application id for determinism).
 */
export function proposeMatches(
  candidates: MatchCandidate[],
  institutions: MatchInstitution[],
  threshold = QUALIFICATION_THRESHOLD,
): ProposedMatch[] {
  const proposals: ProposedMatch[] = [];
  for (const institution of institutions) {
    const proposers = candidates.filter(
      (c) =>
        c.institutionId === institution.id &&
        (c.finalScorePercent ?? 0) >= threshold &&
        c.institutionState.trim().toUpperCase() === institution.state.trim().toUpperCase(),
    );
    if (proposers.length === 0) continue;
    const [winner] = proposers
      .map((candidate) => ({ candidate, ...computeMci(candidate, institution) }))
      .sort(
        (a, b) =>
          b.matchCompatibilityIndex - a.matchCompatibilityIndex ||
          (b.candidate.finalScorePercent ?? 0) - (a.candidate.finalScorePercent ?? 0) ||
          a.candidate.applicationId.localeCompare(b.candidate.applicationId),
      );
    proposals.push({
      institutionId: institution.id,
      applicationId: winner.candidate.applicationId,
      matchCompatibilityIndex: winner.matchCompatibilityIndex,
      hubAlignmentScore: winner.hubAlignmentScore,
      capacityAlignment: winner.capacityAlignment,
      institutionalRelationshipScore: winner.institutionalRelationshipScore,
    });
  }
  return proposals;
}
