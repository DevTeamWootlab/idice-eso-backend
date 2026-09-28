import {
  Gender,
  Pillar,
  TrainingTier,
} from '@/common/enums/beneficiary.enum';

export const PCU_TARGETS = {
  youthEnrolled: 25000,
  femaleParticipationPercent: 40,
  startupsPerCoe: 600,
  jobPlacementPercent: 80,
  tiers: {
    [TrainingTier.FOUNDATIONAL]: 10000,
    [TrainingTier.INTERMEDIATE]: 9000,
    [TrainingTier.ADVANCED]: 6000,
  } as Record<TrainingTier, number>,
};

const TIER_ORDER = [
  TrainingTier.FOUNDATIONAL,
  TrainingTier.INTERMEDIATE,
  TrainingTier.ADVANCED,
];

export interface InstitutionRow {
  id: string;
  name: string;
  state: string;
  isActive: boolean;
}

/** One GROUP BY row over ALLOCATED beneficiaries (Postgres returns counts as strings). */
export interface EnrolledGroupRow {
  institutionId: string | null;
  pillar: string;
  gender: string;
  count: string | number;
  inclusionCount: string | number;
}

export interface TierRow {
  tier: string;
  count: string | number;
}

export interface PcuInputs {
  institutions: InstitutionRow[];
  enrolled: EnrolledGroupRow[];
  tiers: TierRow[];
  completers: number;
  placed: number;
  now?: Date;
}

export interface PcuMetricsResponse {
  generatedAt: string;
  youthEnrolled: { value: number; target: number };
  femaleParticipation: {
    participants: number;
    percent: number | null;
    target: number;
  };
  startupsIncubated: { value: number; targetPerCoe: number; coeCount: number };
  pillars: { skills: number; incubation: number; acceleration: number };
  jobPlacement: {
    placed: number;
    completers: number;
    percent: number | null;
    target: number;
  };
  neetPwdInclusion: { participants: number; percent: number | null };
  skillTiers: { tier: TrainingTier; completed: number; target: number }[];
  perCoe: {
    institutionId: string;
    name: string;
    state: string;
    youthEnrolled: number;
    startupsIncubated: number;
    enterprisesAccelerated: number;
  }[];
}

const toNumber = (value: string | number | null | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Percentage to one decimal place, or null when there is nothing to divide by. */
export const percentOf = (part: number, whole: number): number | null =>
  whole > 0 ? round1((part / whole) * 100) : null;

/**
 * Definitions (kept in one place so the dashboard and any export agree):
 *  - enrolled            beneficiary with status ALLOCATED, counted at their assigned CoE
 *  - female participation FEMALE share of enrolled
 *  - startups incubated  enrolled beneficiaries in the INCUBATION pillar
 *  - skill tier progress distinct beneficiaries with a completed cohort in a course of that tier
 *  - job placement       verified employment outcomes among beneficiaries who completed
 *                        training, over all beneficiaries who completed training
 *  - NEET/PWD inclusion  enrolled beneficiaries flagged NEET or with an assistive requirement
 */
export function buildPcuMetrics(input: PcuInputs): PcuMetricsResponse {
  let youthEnrolled = 0;
  let female = 0;
  let inclusion = 0;
  let startups = 0;
  let skills = 0;
  let accelerated = 0;
  const youthByInstitution = new Map<string, number>();
  const startupsByInstitution = new Map<string, number>();
  const acceleratedByInstitution = new Map<string, number>();

  for (const row of input.enrolled) {
    const count = toNumber(row.count);
    youthEnrolled += count;
    inclusion += toNumber(row.inclusionCount);
    if (row.gender === Gender.FEMALE) female += count;
    const isStartup = row.pillar === Pillar.INCUBATION;
    const isAccelerated = row.pillar === Pillar.ACCELERATION;
    if (isStartup) startups += count;
    if (isAccelerated) accelerated += count;
    if (row.pillar === Pillar.SKILLS) skills += count;
    if (row.institutionId) {
      youthByInstitution.set(
        row.institutionId,
        (youthByInstitution.get(row.institutionId) ?? 0) + count,
      );
      if (isAccelerated) {
        acceleratedByInstitution.set(
          row.institutionId,
          (acceleratedByInstitution.get(row.institutionId) ?? 0) + count,
        );
      }
      if (isStartup) {
        startupsByInstitution.set(
          row.institutionId,
          (startupsByInstitution.get(row.institutionId) ?? 0) + count,
        );
      }
    }
  }

  const tierCounts = new Map(
    input.tiers.map((row) => [row.tier, toNumber(row.count)]),
  );

  const perCoe = input.institutions
    .map((institution) => ({
      institutionId: institution.id,
      name: institution.name,
      state: institution.state,
      youthEnrolled: youthByInstitution.get(institution.id) ?? 0,
      startupsIncubated: startupsByInstitution.get(institution.id) ?? 0,
      enterprisesAccelerated: acceleratedByInstitution.get(institution.id) ?? 0,
      isActive: institution.isActive,
    }))
    .filter((coe) => coe.isActive || coe.youthEnrolled > 0)
    .map(({ isActive: _isActive, ...coe }) => coe);

  return {
    generatedAt: (input.now ?? new Date()).toISOString(),
    youthEnrolled: { value: youthEnrolled, target: PCU_TARGETS.youthEnrolled },
    femaleParticipation: {
      participants: female,
      percent: percentOf(female, youthEnrolled),
      target: PCU_TARGETS.femaleParticipationPercent,
    },
    startupsIncubated: {
      value: startups,
      targetPerCoe: PCU_TARGETS.startupsPerCoe,
      coeCount: input.institutions.filter((i) => i.isActive).length,
    },
    pillars: { skills, incubation: startups, acceleration: accelerated },
    jobPlacement: {
      placed: input.placed,
      completers: input.completers,
      percent: percentOf(input.placed, input.completers),
      target: PCU_TARGETS.jobPlacementPercent,
    },
    neetPwdInclusion: {
      participants: inclusion,
      percent: percentOf(inclusion, youthEnrolled),
    },
    skillTiers: TIER_ORDER.map((tier) => ({
      tier,
      completed: tierCounts.get(tier) ?? 0,
      target: PCU_TARGETS.tiers[tier],
    })),
    perCoe,
  };
}
