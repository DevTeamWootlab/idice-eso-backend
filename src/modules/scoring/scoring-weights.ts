export const RUBRIC_DIMENSIONS = [
  { code: 'LOCAL_PRESENCE', field: 'localPresenceScore', label: 'Local Presence & Relevance to State Ecosystem', defaultWeight: 20 },
  { code: 'TEAM_EXPERTISE', field: 'teamExpertiseScore', label: 'Strong Team Expertise', defaultWeight: 20 },
  { code: 'INCUBATION_EXPERIENCE', field: 'incubationExperienceScore', label: 'Startup Incubation, Acceleration & Business Development Experience', defaultWeight: 15 },
  { code: 'GOVERNANCE_COMPLIANCE', field: 'credibilityGovernanceScore', label: 'ESO Credibility, Governance & Compliance', defaultWeight: 15 },
  { code: 'DELIVERY_TRACK_RECORD', field: 'deliveryTrackRecordScore', label: 'Programme Delivery Track Record', defaultWeight: 15 },
  { code: 'INSTITUTIONAL_ALIGNMENT', field: 'institutionalAlignmentScore', label: 'Institutional Relationship & Alignment with Host Institution Needs', defaultWeight: 15 },
] as const;

export type RubricCode = (typeof RUBRIC_DIMENSIONS)[number]['code'];
export type ScoreField = (typeof RUBRIC_DIMENSIONS)[number]['field'];
export type RubricWeights = Record<RubricCode, number>;

export const RUBRIC_CODES = RUBRIC_DIMENSIONS.map((d) => d.code) as RubricCode[];

export const DEFAULT_WEIGHTS = Object.fromEntries(
  RUBRIC_DIMENSIONS.map((d) => [d.code, d.defaultWeight]),
) as RubricWeights;

const TOTAL_TOLERANCE = 0.005;

export interface WeightRow {
  dimensionCode: string;
  weightPercentage: number | string;
}

const sum = (weights: Record<string, number>) =>
  Object.values(weights).reduce((total, weight) => total + weight, 0);

/**
 * The weights scoring actually uses. Falls back to the PRD defaults unless the stored
 * rows are complete and total exactly 100 — a partly seeded or hand-edited table must
 * never silently skew every composite score.
 */
export function resolveWeights(rows: WeightRow[] | null | undefined): RubricWeights {
  if (!rows || rows.length === 0) return { ...DEFAULT_WEIGHTS };
  const found: Partial<RubricWeights> = {};
  for (const row of rows) {
    const weight = Number(row.weightPercentage);
    if ((RUBRIC_CODES as string[]).includes(row.dimensionCode) && Number.isFinite(weight) && weight >= 0) {
      found[row.dimensionCode as RubricCode] = weight;
    }
  }
  const complete = RUBRIC_CODES.every((code) => found[code] !== undefined);
  if (!complete || Math.abs(sum(found as RubricWeights) - 100) > TOTAL_TOLERANCE) {
    return { ...DEFAULT_WEIGHTS };
  }
  return found as RubricWeights;
}

/** Why a proposed set of weights is invalid, or null when it is acceptable. */
export function validateWeightsInput(
  input: { dimensionCode: string; weightPercentage: number }[],
): string | null {
  const seen = new Set<string>();
  for (const item of input) {
    if (!(RUBRIC_CODES as string[]).includes(item.dimensionCode)) {
      return `Unknown scoring dimension: ${item.dimensionCode}`;
    }
    if (seen.has(item.dimensionCode)) {
      return `Duplicate scoring dimension: ${item.dimensionCode}`;
    }
    seen.add(item.dimensionCode);
    if (!Number.isFinite(item.weightPercentage) || item.weightPercentage < 0 || item.weightPercentage > 100) {
      return `${item.dimensionCode} weight must be between 0 and 100`;
    }
  }
  const missing = RUBRIC_CODES.filter((code) => !seen.has(code));
  if (missing.length > 0) return `Missing scoring dimensions: ${missing.join(', ')}`;
  const total = input.reduce((acc, item) => acc + item.weightPercentage, 0);
  if (Math.abs(total - 100) > TOTAL_TOLERANCE) {
    return `Weights must total 100% (currently ${Math.round(total * 100) / 100}%)`;
  }
  return null;
}

/** Composite percentage (0–100) from six 0–5 dimension scores. */
export function compositePercent(
  scores: Record<ScoreField, number>,
  weights: RubricWeights,
): number {
  let total = 0;
  for (const { code, field } of RUBRIC_DIMENSIONS) {
    total += (scores[field] / 5.0) * weights[code];
  }
  return Math.round(total * 100) / 100;
}
