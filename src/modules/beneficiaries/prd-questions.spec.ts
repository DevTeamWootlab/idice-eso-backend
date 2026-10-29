import {
  ACCELERATION_QUESTIONS,
  INCUBATION_QUESTIONS,
  checkAnswers,
  deriveAccelerationColumns,
  deriveIncubationColumns,
} from './prd-questions';

const DECK = { url: 'https://res.cloudinary.com/demo/raw/upload/v1/beneficiary-documents/deck.pdf', name: 'deck.pdf' };

const VALID_INCUBATION = {
  ventureName: 'AgroLink',
  sector: 'Agriculture',
  stage: 'Prototype',
  ventureDescription: 'A marketplace linking smallholder farmers to buyers.',
  problem: 'Farmers lose produce because they cannot reach buyers.',
  solution: 'A USSD marketplace that matches farmers with buyers.',
  innovationUse: 'USSD and a web dashboard.',
  targetCustomer: 'Smallholder farmers and wholesale buyers.',
  validationEvidence: 'Interviewed 40 farmers.',
  marketOpportunity: 'Millions of smallholder farmers in Nigeria.',
  revenueModel: 'A small commission on each sale.',
  progress: ['Idea developed', 'Prototype developed'],
  applyingAs: 'Team',
  teamDescription: 'Three founders: product, engineering and operations.',
  teamPositioning: 'We grew up in farming families.',
  priorSupport: 'No',
  supportAreas: ['Mentorship', 'Funding Readiness'],
  milestones: 'Launch MVP, sign 100 farmers, run a pilot.',
  biggestChallenge: 'Funding for field operations.',
  availability: 'Yes',
};

const VALID_ACCELERATION = {
  countryOfResidence: 'Nigeria',
  linkedinOrWebsite: 'https://linkedin.com/in/founder',
  primaryRole: 'Chief Executive Officer',
  fullTimeFounder: 'Yes',
  hasCoFounder: 'Yes',
  foundedBefore: 'No',
  launched: 'Yes',
  companyName: 'PayNexus Ltd',
  cacRegistered: 'Yes',
  cacNumber: 'RC1234567',
  headquartersState: 'Kwara',
  sector: 'Financial Services',
  companyDescription: 'Payments for small retailers.',
  coreProduct: 'A point-of-sale app.',
  revenueModel: 'Transaction fees.',
  businessModelType: 'B2B',
  operationsStart: '2023-04',
  fullTimeDuration: '1–2 years',
  stage: 'Early revenue',
  technology: 'React Native and Node.js',
  problem: 'Small retailers cannot accept card payments cheaply.',
  founderAdvantage: 'Ten years in retail banking.',
  differentiation: 'Lower fees and offline support.',
  totalAddressableMarketUsd: 50000000,
  accessibility: 'Yes, retailers without bank terminals can now take payments.',
  productDemoLink: 'https://paynexus.example/demo',
  hasActiveUsers: 'Yes',
  activeUsers: 1200,
  payingCustomers: 300,
  hasTractionEvidence: 'Yes',
  tractionItems: ['Revenue from any source'],
  tractionEvidenceLink: 'https://drive.google.com/folder/x',
  revenueStatus: 'Post-revenue',
  annualRevenueUsd: 40000,
  monthlyRevenueThreeMonthsAgo: 3000,
  pitchDeck: DECK,
  accurateAndComplete: true,
  leadFounderParticipation: true,
  dataUseConsent: true,
  postProgrammeUpdates: true,
};

describe('PRD question answers', () => {
  it('accepts a complete incubation application', () => {
    expect(checkAnswers(INCUBATION_QUESTIONS, VALID_INCUBATION)).toEqual([]);
  });

  it('accepts a complete acceleration application', () => {
    expect(checkAnswers(ACCELERATION_QUESTIONS, VALID_ACCELERATION)).toEqual([]);
  });

  it('requires follow-up answers only when their trigger is chosen', () => {
    expect(checkAnswers(INCUBATION_QUESTIONS, { ...VALID_INCUBATION, priorSupport: 'Yes' })).toContain('priorSupportDetails is required');
    const preRevenue = { ...VALID_ACCELERATION, revenueStatus: 'Pre-revenue' } as Record<string, unknown>;
    delete preRevenue.annualRevenueUsd;
    delete preRevenue.monthlyRevenueThreeMonthsAgo;
    expect(checkAnswers(ACCELERATION_QUESTIONS, preRevenue)).toEqual([]);
  });

  it('rejects unknown keys, unlisted options and word limits', () => {
    const problems = checkAnswers(INCUBATION_QUESTIONS, {
      ...VALID_INCUBATION,
      sector: 'Space',
      ventureDescription: 'word '.repeat(51),
      extra: 'x',
    });
    expect(problems).toEqual(
      expect.arrayContaining([
        'extra is not a recognised question',
        'sector must be one of the listed options',
        'ventureDescription must not exceed 50 words',
      ]),
    );
  });

  it('requires the pitch deck upload and every acceleration declaration', () => {
    const problems = checkAnswers(ACCELERATION_QUESTIONS, {
      ...VALID_ACCELERATION,
      pitchDeck: { url: 'https://evil.example/deck.pdf' },
      postProgrammeUpdates: false,
    });
    expect(problems).toEqual(
      expect.arrayContaining(['pitchDeck was not uploaded through this form', 'postProgrammeUpdates must be confirmed']),
    );
  });

  it('derives the summary columns used by ESO and admin views', () => {
    expect(deriveIncubationColumns(VALID_INCUBATION)).toMatchObject({
      sectorFocus: 'Agriculture',
      currentStage: 'Prototype',
      teamSizeAndRoles: 'Three founders: product, engineering and operations.',
      availableForFullDuration: true,
    });
    expect(deriveAccelerationColumns(VALID_ACCELERATION)).toMatchObject({
      registeredBusinessName: 'PayNexus Ltd',
      cacRegistrationNumber: 'RC1234567',
      yearFounded: 2023,
      developmentStage: 'EARLY_REVENUE',
      pitchDeckStorageKey: DECK.url,
    });
    expect(deriveAccelerationColumns({ ...VALID_ACCELERATION, cacRegistered: 'No' }).cacRegistrationNumber).toBeNull();
  });
});
