import { averageOfPercents, compositePercent, DEFAULT_WEIGHTS, toValidPercent } from './scoring-weights';
import { decimalTransformer } from '@/common/utils/decimal.transformer';

describe('scoring percentages', () => {
  it('averages decimal columns returned as strings by the pg driver', () => {
    expect(averageOfPercents('100.00', '100.00')).toBe(100);
    expect(averageOfPercents('72.50', '70.00')).toBe(71.25);
  });

  it('never produces NaN for an average', () => {
    expect(averageOfPercents('NaN', '100.00')).toBeNull();
    expect(averageOfPercents(undefined, 80)).toBeNull();
    expect(averageOfPercents(null, 80)).toBeNull();
  });

  it('rejects values outside 0 to 100', () => {
    expect(toValidPercent(-1)).toBeNull();
    expect(toValidPercent(100.01)).toBeNull();
    expect(toValidPercent('0')).toBe(0);
  });

  it('scores a perfect card at exactly 100%', () => {
    const perfect = {
      localPresenceScore: 5,
      teamExpertiseScore: 5,
      incubationExperienceScore: 5,
      credibilityGovernanceScore: 5,
      deliveryTrackRecordScore: 5,
      institutionalAlignmentScore: 5,
    };
    expect(compositePercent(perfect, DEFAULT_WEIGHTS)).toBe(100);
  });

  it('converts stored decimal strings back to numbers', () => {
    expect(decimalTransformer.from('100.00')).toBe(100);
    expect(decimalTransformer.from(null)).toBeNull();
  });
});
