import { buildPcuMetrics, percentOf, PCU_TARGETS } from './pcu-metrics';

const institutions = [
  { id: 'i1', name: 'Alpha University', state: 'Benue', isActive: true },
  { id: 'i2', name: 'Beta Poly', state: 'Kwara', isActive: true },
  { id: 'i3', name: 'Retired Hub', state: 'Niger', isActive: false },
  { id: 'i4', name: 'Retired Hub With Youth', state: 'Kogi', isActive: false },
];
const now = new Date('2026-09-19T10:00:00Z');

describe('percentOf', () => {
  it('rounds to one decimal and returns null for an empty denominator', () => {
    expect(percentOf(1, 3)).toBe(33.3);
    expect(percentOf(0, 10)).toBe(0);
    expect(percentOf(5, 0)).toBe(null);
  });
});

describe('buildPcuMetrics', () => {
  it('reports honest zeros / nulls when nothing has happened yet', () => {
    const m = buildPcuMetrics({ institutions, enrolled: [], tiers: [], completers: 0, placed: 0, now });
    expect(m.youthEnrolled.value).toBe(0);
    expect(m.youthEnrolled.target).toBe(PCU_TARGETS.youthEnrolled);
    expect(m.femaleParticipation.percent).toBe(null);
    expect(m.jobPlacement.percent).toBe(null);
    expect(m.neetPwdInclusion.percent).toBe(null);
    expect(m.startupsIncubated.coeCount).toBe(3 - 1);
    expect(m.skillTiers.map((t) => t.completed)).toEqual([0, 0, 0]);
    expect(m.perCoe.map((c) => c.name)).toEqual(['Alpha University', 'Beta Poly']);
    expect(m.generatedAt).toBe('2026-09-19T10:00:00.000Z');
  });

  it('aggregates enrolment, gender, startups and inclusion from grouped rows', () => {
    const m = buildPcuMetrics({
      institutions,
      enrolled: [
        { institutionId: 'i1', pillar: 'SKILLS', gender: 'FEMALE', count: '30', inclusionCount: '6' },
        { institutionId: 'i1', pillar: 'SKILLS', gender: 'MALE', count: '50', inclusionCount: '4' },
        { institutionId: 'i1', pillar: 'INCUBATION', gender: 'FEMALE', count: '10', inclusionCount: '0' },
        { institutionId: 'i2', pillar: 'INCUBATION', gender: 'MALE', count: 10, inclusionCount: 0 },
      ],
      tiers: [],
      completers: 0,
      placed: 0,
      now,
    });
    expect(m.youthEnrolled.value).toBe(100);
    expect(m.femaleParticipation.participants).toBe(40);
    expect(m.femaleParticipation.percent).toBe(40);
    expect(m.startupsIncubated.value).toBe(20);
    expect(m.neetPwdInclusion.participants).toBe(10);
    expect(m.neetPwdInclusion.percent).toBe(10);
    const alpha = m.perCoe.find((c) => c.institutionId === 'i1');
    expect(alpha?.youthEnrolled).toBe(90);
    expect(alpha?.startupsIncubated).toBe(10);
    const beta = m.perCoe.find((c) => c.institutionId === 'i2');
    expect(beta?.youthEnrolled).toBe(10);
  });

  it('keeps an inactive CoE in the breakdown only while it still holds enrolled youth', () => {
    const m = buildPcuMetrics({
      institutions,
      enrolled: [{ institutionId: 'i4', pillar: 'SKILLS', gender: 'MALE', count: '7', inclusionCount: '0' }],
      tiers: [],
      completers: 0,
      placed: 0,
      now,
    });
    expect(m.perCoe.map((c) => c.institutionId)).toEqual(['i1', 'i2', 'i4']);
    expect(m.youthEnrolled.value).toBe(7);
  });

  it('counts enrolled youth with no assigned CoE in totals but not in any CoE row', () => {
    const m = buildPcuMetrics({
      institutions,
      enrolled: [{ institutionId: null, pillar: 'SKILLS', gender: 'MALE', count: '3', inclusionCount: '0' }],
      tiers: [],
      completers: 0,
      placed: 0,
      now,
    });
    expect(m.youthEnrolled.value).toBe(3);
    expect(m.perCoe.every((c) => c.youthEnrolled === 0)).toBe(true);
  });

  it('orders tiers, fills gaps, and computes the placement rate over completers', () => {
    const m = buildPcuMetrics({
      institutions,
      enrolled: [],
      tiers: [
        { tier: 'ADVANCED', count: '5' },
        { tier: 'FOUNDATIONAL', count: '40' },
      ],
      completers: 45,
      placed: 9,
      now,
    });
    expect(m.skillTiers.map((t) => [t.tier, t.completed, t.target])).toEqual([
      ['FOUNDATIONAL', 40, 10000],
      ['INTERMEDIATE', 0, 9000],
      ['ADVANCED', 5, 6000],
    ]);
    expect(m.jobPlacement.percent).toBe(20);
    expect(m.jobPlacement.placed).toBe(9);
    expect(m.jobPlacement.completers).toBe(45);
  });
});
