import { checkSkillPreference } from './skill-preference';

describe('skill preference', () => {
  it('accepts no preference at all', () => {
    expect(checkSkillPreference({}, 'STANDARD')).toBeNull();
  });

  it('accepts a digital skill at any hub', () => {
    expect(checkSkillPreference({ focusArea: 'DIGITAL', preferredSkill: 'Cybersecurity' }, 'STANDARD')).toBeNull();
    expect(checkSkillPreference({ focusArea: 'DIGITAL', preferredSkill: 'Spreadsheet' }, 'VR')).toBeNull();
  });

  it('rejects a skill that does not belong to the chosen focus area', () => {
    expect(checkSkillPreference({ focusArea: 'DIGITAL', preferredSkill: 'Content Creation' }, 'STANDARD')).toMatch(/not a digital skill/);
    expect(checkSkillPreference({ preferredSkill: 'Spreadsheet' }, 'STANDARD')).toMatch(/main focus area/);
  });

  it('only allows Virtual Reality at a VR hub and Game Hub at a gaming hub', () => {
    expect(checkSkillPreference({ focusArea: 'CREATIVE', preferredSkill: 'Virtual Reality Skills' }, 'VR')).toBeNull();
    expect(checkSkillPreference({ focusArea: 'CREATIVE', preferredSkill: 'Virtual Reality Skills' }, 'STANDARD')).toMatch(/Minna/);
    expect(checkSkillPreference({ focusArea: 'CREATIVE', preferredSkill: 'Game Hub Skills' }, 'GAMING')).toBeNull();
    expect(checkSkillPreference({ focusArea: 'CREATIVE', preferredSkill: 'Game Hub Skills' }, 'VR')).toMatch(/Ilorin/);
    expect(checkSkillPreference({ focusArea: 'CREATIVE', preferredSkill: 'Content Creation' }, 'GAMING')).toBeNull();
  });
});
