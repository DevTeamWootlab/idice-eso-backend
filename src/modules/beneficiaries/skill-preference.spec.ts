import { checkCourseForTier, checkSkillPreference } from './skill-preference';

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
  });

  it('only accepts a course that belongs to the chosen level', () => {
    expect(checkCourseForTier('FOUNDATIONAL', 'Data and AI Fundamentals')).toBeNull();
    expect(checkCourseForTier('INTERMEDIATE', 'Full-Stack Development')).toBeNull();
    expect(checkCourseForTier('ADVANCED', 'Software Engineering, Cloud Development and DevOps')).toBeNull();
    expect(checkCourseForTier('FOUNDATIONAL', 'Advanced Cybersecurity')).toMatch(/not one of the Foundational courses/);
    expect(checkCourseForTier('ADVANCED', 'Made-up course')).toMatch(/not one of the Advanced courses/);
  });

  it('uses the Virtual Reality and Game Hub course lists for those skills', () => {
    expect(checkCourseForTier('FOUNDATIONAL', 'Foundation of VR and Immersive 3D Creation', 'Virtual Reality Skills')).toBeNull();
    expect(checkCourseForTier('ADVANCED', 'Engine Optimisation, Tactical Mastery and Mental Resilience', 'Game Hub Skills')).toBeNull();
    expect(checkCourseForTier('FOUNDATIONAL', 'Data and AI Fundamentals', 'Virtual Reality Skills')).toMatch(/not one of the Foundational courses/);
    expect(checkCourseForTier('INTERMEDIATE', '3D Assets, Animation and Engine Programming', 'Cybersecurity')).toMatch(/not one of the Intermediate courses/);
    expect(checkCourseForTier('INTERMEDIATE', 'Full-Stack Development', 'Spreadsheet')).toBeNull();
  });

  it('offers Content Creation only at the regular centres, with its own courses', () => {
    expect(checkSkillPreference({ focusArea: 'CREATIVE', preferredSkill: 'Content Creation' }, 'STANDARD')).toBeNull();
    expect(checkSkillPreference({ focusArea: 'CREATIVE', preferredSkill: 'Content Creation' }, 'CREATIVE')).toBeNull();
    expect(checkSkillPreference({ focusArea: 'CREATIVE', preferredSkill: 'Content Creation' }, 'VR')).toMatch(/not offered at the Virtual Reality or Game Hub centres/);
    expect(checkSkillPreference({ focusArea: 'CREATIVE', preferredSkill: 'Content Creation' }, 'GAMING')).toMatch(/not offered at the Virtual Reality or Game Hub centres/);
    expect(checkCourseForTier('FOUNDATIONAL', 'Creative Writing Fundamentals', 'Content Creation')).toBeNull();
    expect(checkCourseForTier('ADVANCED', 'Mastery in Narrative Architecture and Authorial Voice', 'Content Creation')).toBeNull();
    expect(checkCourseForTier('INTERMEDIATE', 'Full-Stack Development', 'Content Creation')).toMatch(/not one of the Intermediate courses/);
  });
});
