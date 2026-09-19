import {
  compositePercent,
  DEFAULT_WEIGHTS,
  resolveWeights,
  RUBRIC_CODES,
  validateWeightsInput,
} from './scoring-weights';

const scores = {
  localPresenceScore: 4,
  teamExpertiseScore: 5,
  incubationExperienceScore: 3,
  credibilityGovernanceScore: 4,
  deliveryTrackRecordScore: 2,
  institutionalAlignmentScore: 5,
};

// The formula scoring used before the weights became configurable.
const legacyComposite = () => {
  const fixed = [
    ['localPresenceScore', 20], ['teamExpertiseScore', 20], ['incubationExperienceScore', 15],
    ['credibilityGovernanceScore', 15], ['deliveryTrackRecordScore', 15], ['institutionalAlignmentScore', 15],
  ] as const;
  let total = 0;
  for (const [key, weight] of fixed) total += ((scores as Record<string, number>)[key] / 5.0) * weight;
  return Math.round(total * 100) / 100;
};

const rows = (weights: Record<string, number>) =>
  Object.entries(weights).map(([dimensionCode, weightPercentage]) => ({ dimensionCode, weightPercentage }));

describe('compositePercent', () => {
  it('matches the previous hard-coded formula exactly when using the default weights', () => {
    expect(compositePercent(scores, DEFAULT_WEIGHTS)).toBe(legacyComposite());
    expect(compositePercent(scores, DEFAULT_WEIGHTS)).toBe(78);
  });

  it('follows edited weights', () => {
    const weights = { ...DEFAULT_WEIGHTS, LOCAL_PRESENCE: 50, TEAM_EXPERTISE: 5, INCUBATION_EXPERIENCE: 5, GOVERNANCE_COMPLIANCE: 10, DELIVERY_TRACK_RECORD: 10, INSTITUTIONAL_ALIGNMENT: 20 };
    expect(compositePercent(scores, weights)).toBe(40 + 5 + 3 + 8 + 4 + 20);
  });

  it('scores 100 for perfect marks and 0 for zeros', () => {
    const perfect = Object.fromEntries(Object.keys(scores).map((k) => [k, 5])) as typeof scores;
    const zero = Object.fromEntries(Object.keys(scores).map((k) => [k, 0])) as typeof scores;
    expect(compositePercent(perfect, DEFAULT_WEIGHTS)).toBe(100);
    expect(compositePercent(zero, DEFAULT_WEIGHTS)).toBe(0);
  });
});

describe('resolveWeights', () => {
  it('uses stored weights when complete and totalling 100 (decimal strings from Postgres)', () => {
    const stored = rows({ ...DEFAULT_WEIGHTS, LOCAL_PRESENCE: 30, TEAM_EXPERTISE: 10 });
    const resolved = resolveWeights(stored.map((r) => ({ ...r, weightPercentage: r.weightPercentage.toFixed(2) })));
    expect(resolved.LOCAL_PRESENCE).toBe(30);
    expect(resolved.TEAM_EXPERTISE).toBe(10);
  });

  it('falls back to the PRD defaults for empty, partial, unknown-only or mis-totalled data', () => {
    expect(resolveWeights([])).toEqual(DEFAULT_WEIGHTS);
    expect(resolveWeights(null)).toEqual(DEFAULT_WEIGHTS);
    expect(resolveWeights(rows({ LOCAL_PRESENCE: 100 }))).toEqual(DEFAULT_WEIGHTS);
    expect(resolveWeights(rows({ ...DEFAULT_WEIGHTS, LOCAL_PRESENCE: 25 }))).toEqual(DEFAULT_WEIGHTS);
    expect(resolveWeights(rows({ NOPE: 100 }))).toEqual(DEFAULT_WEIGHTS);
  });
});

describe('validateWeightsInput', () => {
  const valid = rows(DEFAULT_WEIGHTS);

  it('accepts all six dimensions totalling 100', () => {
    expect(validateWeightsInput(valid)).toBe(null);
    expect(RUBRIC_CODES).toHaveLength(6);
  });

  it('rejects a total other than 100 and says what it is', () => {
    expect(validateWeightsInput(rows({ ...DEFAULT_WEIGHTS, LOCAL_PRESENCE: 25 }))).toBe('Weights must total 100% (currently 105%)');
  });

  it('rejects unknown, duplicate, missing and out-of-range dimensions', () => {
    expect(validateWeightsInput([...valid, { dimensionCode: 'NOPE', weightPercentage: 0 }])).toBe('Unknown scoring dimension: NOPE');
    expect(validateWeightsInput([...valid, valid[0]])).toBe('Duplicate scoring dimension: LOCAL_PRESENCE');
    expect(validateWeightsInput(valid.slice(1))).toContain('Missing scoring dimensions: LOCAL_PRESENCE');
    expect(validateWeightsInput(rows({ ...DEFAULT_WEIGHTS, LOCAL_PRESENCE: -5, TEAM_EXPERTISE: 45 }))).toBe('LOCAL_PRESENCE weight must be between 0 and 100');
  });
});
