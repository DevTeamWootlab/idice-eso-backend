export const PRD_COURSES_BY_TIER: Record<string, string[]> = {
  FOUNDATIONAL: [
    'Customer Service & Call Centre Operations',
    'Data Entry & Administrative Operations',
    'Technical Support & IT Helpdesk Fundamentals',
    'Digital Literacy & Workplace Productivity',
  ],
  INTERMEDIATE: [
    'Advanced Customer Service & Process Mapping',
    'Data Analysis & Business Intelligence',
    'Content Creation, Digital Copywriting & SEO',
    'Digital Product Management',
    'Graphic Design & Visual Identity',
    'UI/UX Design',
    'Coding & Software Engineering Basics',
    '2D Animation & Motion Graphics',
  ],
  ADVANCED: [
    'Advanced Motion Graphics & 3D Animation',
    'Applied AI Tools for Creative & Technical Work',
    'Digital Marketing Strategy & Paid Media',
    'Cybersecurity & Data Protection',
    'Game Design & Interactive Media',
    'Virtual Reality (VR) / Augmented Reality (AR) Development',
  ],
};

export const COURSE_HUB_RESTRICTIONS: Record<string, { hubType: string; institution: string }> = {
  'Game Design & Interactive Media': { hubType: 'GAMING', institution: 'University of Ilorin, Kwara State' },
  'Virtual Reality (VR) / Augmented Reality (AR) Development': {
    hubType: 'VR',
    institution: 'Federal University of Technology, Minna, Niger State',
  },
};

export const EDUCATION_LEVELS = ['Secondary / SSCE', 'OND', 'HND', 'BSc/BA', 'Postgraduate', 'Non-formal / Self-taught'];

const TIER_NAMES: Record<string, string> = {
  FOUNDATIONAL: 'Foundational',
  INTERMEDIATE: 'Intermediary / Developmental',
  ADVANCED: 'Specialised',
};

export function checkCourseForTier(skillTier: string, course: string, hubType?: string | null): string | null {
  const courses = PRD_COURSES_BY_TIER[skillTier];
  if (!courses) return `Unknown course level "${skillTier}".`;
  if (!courses.includes(course)) {
    return `"${course}" is not one of the ${TIER_NAMES[skillTier]} courses. Choose one of: ${courses.join('; ')}.`;
  }
  const restriction = COURSE_HUB_RESTRICTIONS[course];
  if (restriction && hubType && hubType.toUpperCase() !== restriction.hubType) {
    return `${course} is only offered at ${restriction.institution}. Choose another course or that Centre of Excellence.`;
  }
  return null;
}
