import { checkCourseForTier, PRD_COURSES_BY_TIER } from './skill-preference';

describe('PRD course catalogue', () => {
  it('accepts every listed course at its own tier', () => {
    for (const [tier, courses] of Object.entries(PRD_COURSES_BY_TIER)) {
      for (const course of courses) {
        expect(checkCourseForTier(tier, course, course.startsWith('Game') ? 'GAMING' : course.startsWith('Virtual') ? 'VR' : 'STANDARD')).toBeNull();
      }
    }
  });

  it('rejects a course from another tier', () => {
    expect(checkCourseForTier('FOUNDATIONAL', 'UI/UX Design', 'STANDARD')).toMatch(/not one of the Foundational courses/);
    expect(checkCourseForTier('INTERMEDIATE', 'Cybersecurity & Data Protection', 'STANDARD')).toMatch(/Intermediary \/ Developmental/);
  });

  it('keeps Game Design at the gaming hub and VR/AR at the VR hub', () => {
    expect(checkCourseForTier('ADVANCED', 'Game Design & Interactive Media', 'STANDARD')).toMatch(/University of Ilorin/);
    expect(checkCourseForTier('ADVANCED', 'Game Design & Interactive Media', 'GAMING')).toBeNull();
    expect(checkCourseForTier('ADVANCED', 'Virtual Reality (VR) / Augmented Reality (AR) Development', 'CREATIVE')).toMatch(/Minna/);
  });

  it('rejects an unknown tier', () => {
    expect(checkCourseForTier('EXPERT', 'UI/UX Design')).toMatch(/Unknown course level/);
  });
});
