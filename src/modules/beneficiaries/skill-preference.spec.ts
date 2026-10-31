import { checkCourseForTier, PRD_COURSES_BY_TIER, COURSE_HUB_RESTRICTIONS } from './skill-preference';

describe('PRD course catalogue', () => {
  it('accepts every listed course at its own tier', () => {
    for (const [tier, courses] of Object.entries(PRD_COURSES_BY_TIER)) {
      for (const course of courses) {
        expect(checkCourseForTier(tier, course, COURSE_HUB_RESTRICTIONS[course]?.hubType ?? 'STANDARD')).toBeNull();
      }
    }
  });

  it('rejects a course from another tier', () => {
    expect(checkCourseForTier('FOUNDATIONAL', 'UI/UX Design', 'STANDARD')).toMatch(/not one of the Foundational courses/);
    expect(checkCourseForTier('INTERMEDIATE', 'Cybersecurity & Data Protection', 'STANDARD')).toMatch(/Intermediary \/ Developmental/);
  });

  it('keeps Game Hub courses at the gaming hub and VR courses at the VR hub', () => {
    expect(checkCourseForTier('FOUNDATIONAL', 'Game Development Fundamentals', 'STANDARD')).toMatch(/University of Ilorin/);
    expect(checkCourseForTier('FOUNDATIONAL', 'Game Development Fundamentals', 'GAMING')).toBeNull();
    expect(checkCourseForTier('INTERMEDIATE', 'Programming, Level Design and Competitive Strategy', 'GAMING')).toBeNull();
    expect(checkCourseForTier('ADVANCED', 'Engine Optimisation, Tactical Mastery and Mental Resilience', 'GAMING')).toBeNull();
    expect(checkCourseForTier('ADVANCED', 'Engine Optimisation, Tactical Mastery and Mental Resilience', 'VR')).toMatch(/University of Ilorin/);
    expect(checkCourseForTier('FOUNDATIONAL', 'Foundation of VR and Immersive 3D Creation', 'VR')).toBeNull();
    expect(checkCourseForTier('INTERMEDIATE', '3D Assets, Animation and Engine Programming', 'VR')).toBeNull();
    expect(checkCourseForTier('ADVANCED', 'Advanced VR Engineering and XR Development Mastery', 'CREATIVE')).toMatch(/Minna/);
    expect(checkCourseForTier('INTERMEDIATE', 'Game Development Fundamentals', 'GAMING')).toMatch(/not one of/);
  });

  it('rejects an unknown tier', () => {
    expect(checkCourseForTier('EXPERT', 'UI/UX Design')).toMatch(/Unknown course level/);
  });
});
