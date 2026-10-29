export type AnswerType = 'text' | 'textarea' | 'select' | 'radio' | 'multi' | 'url' | 'number' | 'month' | 'file' | 'files' | 'checkbox';

export interface PrdQuestion {
  key: string;
  type: AnswerType;
  options?: string[];
  optional?: boolean;
  maxWords?: number;
  showIf?: { key: string; equals: string };
  mustBeTrue?: boolean;
}

export type Answers = Record<string, unknown>;

const YES_NO = ['Yes', 'No'];

export const INCUBATION_SECTORS = [
  'Agriculture',
  'Financial Services',
  'Health',
  'Education',
  'Climate & Sustainability',
  'Retail & E-commerce',
  'Media & Entertainment',
  'Creative Economy',
  'Professional Services',
  'Other',
];

export const INCUBATION_STAGES = [
  'Idea Stage',
  'Concept / Problem Validation',
  'Prototype',
  'Early MVP',
  'Market Validation',
  'Early market entry',
];

export const INCUBATION_PROGRESS = [
  'Idea developed',
  'Customer interviews/research completed',
  'Prototype developed',
  'MVP developed',
  'Pilot conducted',
  'Early users/customers',
  'Revenue generated',
  'Partnership secured',
  'Other',
];

export const INCUBATION_SUPPORT_AREAS = [
  'Problem and Customer Validation',
  'Business Model Development',
  'Product / MVP Development',
  'Technical Support',
  'Financial Planning and Pricing',
  'Marketing and Customer Acquisition',
  'Legal and Intellectual Property',
  'Funding Readiness',
  'Mentorship',
  'Market Access and Partnerships',
  'Other',
];

export const INCUBATION_QUESTIONS: PrdQuestion[] = [
  { key: 'ventureName', type: 'text', optional: true },
  { key: 'sector', type: 'select', options: INCUBATION_SECTORS },
  { key: 'stage', type: 'select', options: INCUBATION_STAGES },
  { key: 'ventureDescription', type: 'textarea', maxWords: 50 },
  { key: 'problem', type: 'textarea' },
  { key: 'solution', type: 'textarea' },
  { key: 'innovationUse', type: 'textarea' },
  { key: 'targetCustomer', type: 'textarea' },
  { key: 'validationEvidence', type: 'textarea' },
  { key: 'marketOpportunity', type: 'textarea' },
  { key: 'revenueModel', type: 'textarea' },
  { key: 'progress', type: 'multi', options: INCUBATION_PROGRESS },
  { key: 'progressExplanation', type: 'textarea', optional: true },
  { key: 'evidenceLink', type: 'url', optional: true },
  { key: 'evidenceUpload', type: 'file', optional: true },
  { key: 'applyingAs', type: 'radio', options: ['Individual', 'Team'] },
  { key: 'teamDescription', type: 'textarea' },
  { key: 'teamPositioning', type: 'textarea' },
  { key: 'priorSupport', type: 'radio', options: YES_NO },
  { key: 'priorSupportDetails', type: 'textarea', showIf: { key: 'priorSupport', equals: 'Yes' } },
  { key: 'supportAreas', type: 'multi', options: INCUBATION_SUPPORT_AREAS },
  { key: 'milestones', type: 'textarea' },
  { key: 'biggestChallenge', type: 'textarea' },
  { key: 'availability', type: 'radio', options: YES_NO },
  { key: 'supportingDocuments', type: 'files', optional: true },
];

export const NIGERIAN_STATE_NAMES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta',
  'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi',
  'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
  'Taraba', 'Yobe', 'Zamfara',
];

export const BUSINESS_MODEL_TYPES = ['B2B', 'B2C', 'B2B2C', 'B2G', 'Marketplace', 'Other'];

export const FULL_TIME_DURATIONS = ['Less than 6 months', '6–12 months', '1–2 years', '2–3 years', 'More than 3 years'];

export const ACCELERATION_STAGES = ['MVP', 'Early revenue', 'Growth', 'Scaling'];

export const TRACTION_ITEMS = [
  'Signed Letter of Intent (LOI) or partnership agreement',
  'Waitlist with documented engagement',
  'Completed pilot with a named organisation',
  'Revenue from any source',
];

export const ACCELERATION_DECLARATIONS = [
  'accurateAndComplete',
  'leadFounderParticipation',
  'dataUseConsent',
  'postProgrammeUpdates',
];

export const ACCELERATION_QUESTIONS: PrdQuestion[] = [
  { key: 'countryOfResidence', type: 'text' },
  { key: 'linkedinOrWebsite', type: 'url' },
  { key: 'primaryRole', type: 'text' },
  { key: 'fullTimeFounder', type: 'radio', options: YES_NO },
  { key: 'hasCoFounder', type: 'radio', options: YES_NO },
  { key: 'foundedBefore', type: 'radio', options: YES_NO },
  { key: 'previousCompanyOutcome', type: 'textarea', maxWords: 50, showIf: { key: 'foundedBefore', equals: 'Yes' } },
  { key: 'launched', type: 'radio', options: YES_NO },
  { key: 'companyName', type: 'text' },
  { key: 'cacRegistered', type: 'radio', options: YES_NO },
  { key: 'cacNumber', type: 'text', showIf: { key: 'cacRegistered', equals: 'Yes' } },
  { key: 'headquartersState', type: 'select', options: NIGERIAN_STATE_NAMES },
  { key: 'sector', type: 'select', options: INCUBATION_SECTORS },
  { key: 'companyDescription', type: 'textarea', maxWords: 50 },
  { key: 'coreProduct', type: 'textarea' },
  { key: 'revenueModel', type: 'textarea', maxWords: 150 },
  { key: 'businessModelType', type: 'select', options: BUSINESS_MODEL_TYPES },
  { key: 'productUrl', type: 'url', optional: true },
  { key: 'operationsStart', type: 'month' },
  { key: 'fullTimeDuration', type: 'select', options: FULL_TIME_DURATIONS },
  { key: 'stage', type: 'select', options: ACCELERATION_STAGES },
  { key: 'technology', type: 'text' },
  { key: 'problem', type: 'textarea', maxWords: 100 },
  { key: 'founderAdvantage', type: 'textarea', maxWords: 50 },
  { key: 'differentiation', type: 'textarea', maxWords: 50 },
  { key: 'totalAddressableMarketUsd', type: 'number' },
  { key: 'accessibility', type: 'textarea' },
  { key: 'productDemoLink', type: 'url' },
  { key: 'hasActiveUsers', type: 'radio', options: YES_NO },
  { key: 'activeUsers', type: 'number', showIf: { key: 'hasActiveUsers', equals: 'Yes' } },
  { key: 'payingCustomers', type: 'number', showIf: { key: 'hasActiveUsers', equals: 'Yes' } },
  { key: 'hasTractionEvidence', type: 'radio', options: YES_NO },
  { key: 'tractionItems', type: 'multi', options: TRACTION_ITEMS, optional: true },
  { key: 'tractionEvidenceLink', type: 'url', showIf: { key: 'hasTractionEvidence', equals: 'Yes' } },
  { key: 'revenueStatus', type: 'select', options: ['Pre-revenue', 'Post-revenue'] },
  { key: 'annualRevenueUsd', type: 'number', showIf: { key: 'revenueStatus', equals: 'Post-revenue' } },
  { key: 'monthlyRevenueThreeMonthsAgo', type: 'number', showIf: { key: 'revenueStatus', equals: 'Post-revenue' } },
  { key: 'pitchDeck', type: 'file' },
  ...ACCELERATION_DECLARATIONS.map((key): PrdQuestion => ({ key, type: 'checkbox', mustBeTrue: true })),
];

const CLOUDINARY_URL = /^https:\/\/res\.cloudinary\.com\/\S{1,480}$/;

function words(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function isBlank(value: unknown) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function fileUrl(value: unknown): string | null {
  if (value && typeof value === 'object' && 'url' in value) {
    const url = (value as { url?: unknown }).url;
    return typeof url === 'string' ? url : null;
  }
  return typeof value === 'string' ? value : null;
}

export function isQuestionShown(question: PrdQuestion, answers: Answers) {
  return !question.showIf || answers[question.showIf.key] === question.showIf.equals;
}

export function checkAnswers(questions: PrdQuestion[], answers: unknown): string[] {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return ['details must be an object'];
  const given = answers as Answers;
  const problems: string[] = [];
  const known = new Set(questions.map((q) => q.key));
  for (const key of Object.keys(given)) {
    if (!known.has(key)) problems.push(`${key} is not a recognised question`);
  }
  for (const q of questions) {
    const value = given[q.key];
    if (!isQuestionShown(q, given)) continue;
    if (q.mustBeTrue) {
      if (value !== true) problems.push(`${q.key} must be confirmed`);
      continue;
    }
    if (isBlank(value)) {
      if (!q.optional) problems.push(`${q.key} is required`);
      continue;
    }
    switch (q.type) {
      case 'text':
      case 'textarea':
        if (typeof value !== 'string') problems.push(`${q.key} must be text`);
        else if (value.length > 5000) problems.push(`${q.key} is too long`);
        else if (q.maxWords && words(value) > q.maxWords) problems.push(`${q.key} must not exceed ${q.maxWords} words`);
        break;
      case 'select':
      case 'radio':
        if (typeof value !== 'string' || !q.options?.includes(value)) problems.push(`${q.key} must be one of the listed options`);
        break;
      case 'multi':
        if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !q.options?.includes(v))) {
          problems.push(`${q.key} must only contain listed options`);
        }
        break;
      case 'url':
        if (typeof value !== 'string' || !/^https?:\/\/\S+\.\S+/i.test(value.trim())) problems.push(`${q.key} must be a valid link`);
        break;
      case 'number':
        if (typeof value !== 'number' && typeof value !== 'string') problems.push(`${q.key} must be a number`);
        else if (!Number.isFinite(Number(value)) || Number(value) < 0) problems.push(`${q.key} must be zero or more`);
        break;
      case 'month':
        if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) problems.push(`${q.key} must be a month in YYYY-MM format`);
        break;
      case 'file': {
        const url = fileUrl(value);
        if (!url || !CLOUDINARY_URL.test(url)) problems.push(`${q.key} was not uploaded through this form`);
        break;
      }
      case 'files':
        if (!Array.isArray(value) || value.some((item) => !CLOUDINARY_URL.test(fileUrl(item) ?? ''))) {
          problems.push(`${q.key} contains a file that was not uploaded through this form`);
        }
        break;
      default:
        break;
    }
  }
  return problems;
}

function str(answers: Answers, key: string): string {
  const value = answers[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function deriveIncubationColumns(answers: Answers) {
  const supportAreas = Array.isArray(answers.supportAreas) ? (answers.supportAreas as string[]) : [];
  return {
    ventureName: str(answers, 'ventureName') || undefined,
    sectorFocus: str(answers, 'sector'),
    problemStatement: str(answers, 'problem'),
    proposedSolution: str(answers, 'solution'),
    targetCustomer: str(answers, 'targetCustomer'),
    currentStage: str(answers, 'stage'),
    teamSizeAndRoles: str(answers, 'teamDescription'),
    technologyPlatform: str(answers, 'innovationUse') || undefined,
    supportNeeded: supportAreas,
    availableForFullDuration: answers.availability === 'Yes',
  };
}

const STAGE_TO_COLUMN: Record<string, string> = {
  MVP: 'MVP',
  'Early revenue': 'EARLY_REVENUE',
  Growth: 'GROWTH',
  Scaling: 'SCALING',
};

export function deriveAccelerationColumns(answers: Answers) {
  const start = str(answers, 'operationsStart');
  return {
    registeredBusinessName: str(answers, 'companyName'),
    cacRegistrationNumber: answers.cacRegistered === 'Yes' ? str(answers, 'cacNumber') || null : null,
    yearFounded: /^\d{4}-/.test(start) ? Number(start.slice(0, 4)) : null,
    sector: str(answers, 'sector'),
    keyTraction: Array.isArray(answers.tractionItems) && answers.tractionItems.length
      ? (answers.tractionItems as string[]).join('; ')
      : undefined,
    primaryGrowthChallenge: null,
    liveProductUrl: str(answers, 'productUrl') || undefined,
    pitchDeckStorageKey: fileUrl(answers.pitchDeck) ?? undefined,
    developmentStage: STAGE_TO_COLUMN[str(answers, 'stage')] ?? null,
    hasRaisedExternalFunding: false,
  };
}
