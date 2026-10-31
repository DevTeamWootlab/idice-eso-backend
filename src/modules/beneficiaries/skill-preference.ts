export const PRD_COURSES_BY_TIER: Record<string, string[]> = {
  FOUNDATIONAL: [
    'Customer Service & Call Centre Operations',
    'Data Entry & Administrative Operations',
    'Technical Support & IT Helpdesk Fundamentals',
    'Digital Literacy & Workplace Productivity',
    'Game Development Fundamentals',
    'Foundation of VR and Immersive 3D Creation',
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
    'Programming, Level Design and Competitive Strategy',
    '3D Assets, Animation and Engine Programming',
  ],
  ADVANCED: [
    'Advanced Motion Graphics & 3D Animation',
    'Applied AI Tools for Creative & Technical Work',
    'Digital Marketing Strategy & Paid Media',
    'Cybersecurity & Data Protection',
    'Engine Optimisation, Tactical Mastery and Mental Resilience',
    'Advanced VR Engineering and XR Development Mastery',
  ],
};

const GAMING_HUB = { hubType: 'GAMING', institution: 'University of Ilorin, Kwara State' };
const VR_HUB = { hubType: 'VR', institution: 'Federal University of Technology, Minna, Niger State' };

export const COURSE_HUB_RESTRICTIONS: Record<string, { hubType: string; institution: string }> = {
  'Game Development Fundamentals': GAMING_HUB,
  'Programming, Level Design and Competitive Strategy': GAMING_HUB,
  'Engine Optimisation, Tactical Mastery and Mental Resilience': GAMING_HUB,
  'Foundation of VR and Immersive 3D Creation': VR_HUB,
  '3D Assets, Animation and Engine Programming': VR_HUB,
  'Advanced VR Engineering and XR Development Mastery': VR_HUB,
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
