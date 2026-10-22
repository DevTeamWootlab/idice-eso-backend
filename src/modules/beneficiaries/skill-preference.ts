import { SkillFocusArea } from '@/common/enums/beneficiary.enum';

export const DIGITAL_SKILLS = ['Spreadsheet', 'Cybersecurity', 'Web Development'];

export const CREATIVE_SKILLS = ['Virtual Reality Skills', 'Game Hub Skills', 'Content Creation'];

export const PREFERRED_SKILLS = [...DIGITAL_SKILLS, ...CREATIVE_SKILLS];

export const SKILL_HUB_RESTRICTIONS: Record<string, { hubType: string; institution: string }> = {
  'Virtual Reality Skills': { hubType: 'VR', institution: 'Federal University of Technology, Minna, Niger State' },
  'Game Hub Skills': { hubType: 'GAMING', institution: 'University of Ilorin, Kwara State' },
};

export const PRIOR_COURSES = [
  'Data and AI Fundamentals (Beginner)',
  'Cybersecurity & Safety (Beginner)',
  'Software Development and Web Design Essentials (Beginner)',
  'Data Analytics and Applied AI (Intermediate)',
  'Essentials for understanding and implementing effective cybersecurity strategies (Intermediate)',
  'Full-Stack Development (Intermediate)',
  'Advanced Data Science and AI Engineering (Advanced)',
  'Advanced Cybersecurity (Advanced)',
  'Software Engineering, Cloud Development and DevOps (Advanced)',
];

export function checkSkillPreference(
  input: { focusArea?: string | null; preferredSkill?: string | null },
  institutionHubType: string | null | undefined,
): string | null {
  const { focusArea, preferredSkill } = input;
  if (!preferredSkill) return null;
  if (!focusArea) return 'Select a main focus area (DIGITAL or CREATIVE) before choosing a preferred skill.';
  const allowed = focusArea === SkillFocusArea.CREATIVE ? CREATIVE_SKILLS : DIGITAL_SKILLS;
  if (!allowed.includes(preferredSkill)) {
    return `"${preferredSkill}" is not a ${focusArea.toLowerCase()} skill. Choose one of: ${allowed.join(', ')}.`;
  }
  const restriction = SKILL_HUB_RESTRICTIONS[preferredSkill];
  if (restriction && (institutionHubType ?? '').toUpperCase() !== restriction.hubType) {
    return `${preferredSkill} is only offered at ${restriction.institution}. Choose another skill or that Centre of Excellence.`;
  }
  return null;
}

export const COURSES_BY_TIER: Record<string, string[]> = {
  FOUNDATIONAL: [
    'Data and AI Fundamentals',
    'Cybersecurity & Safety',
    'Software Development and Web Design Essentials',
  ],
  INTERMEDIATE: [
    'Data Analytics and Applied AI',
    'Essentials for understanding and implementing effective cybersecurity strategies',
    'Full-Stack Development',
  ],
  ADVANCED: [
    'Advanced Data Science and AI Engineering',
    'Advanced Cybersecurity',
    'Software Engineering, Cloud Development and DevOps',
  ],
};

export function checkCourseForTier(skillTier: string, course: string): string | null {
  const courses = COURSES_BY_TIER[skillTier];
  if (!courses) return `Unknown course level "${skillTier}".`;
  if (!courses.includes(course)) {
    const level = skillTier.charAt(0) + skillTier.slice(1).toLowerCase();
    return `"${course}" is not one of the ${level} courses. Choose one of: ${courses.join('; ')}.`;
  }
  return null;
}
