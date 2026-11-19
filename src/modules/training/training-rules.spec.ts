import { BeneficiaryStatus, Pillar } from '@/common/enums/beneficiary.enum';
import { enrolmentBlocker, recordsProgress } from './training-rules';

const centre = 'centre-a';
const youth = (pillar: Pillar, overrides: Partial<{ status: BeneficiaryStatus; assignedInstitutionId: string }> = {}) => ({
  status: BeneficiaryStatus.ALLOCATED,
  pillar,
  assignedInstitutionId: centre,
  ...overrides,
});

describe('enrolmentBlocker', () => {
  it('lets allocated youth join a cohort of their own programme at their centre', () => {
    expect(enrolmentBlocker(youth(Pillar.SKILLS), { institutionId: centre, pillar: Pillar.SKILLS })).toBeNull();
    expect(enrolmentBlocker(youth(Pillar.INCUBATION), { institutionId: centre, pillar: Pillar.INCUBATION })).toBeNull();
    expect(enrolmentBlocker(youth(Pillar.ACCELERATION), { institutionId: centre, pillar: Pillar.ACCELERATION })).toBeNull();
  });

  it('treats a cohort without a programme as Talent Development', () => {
    expect(enrolmentBlocker(youth(Pillar.SKILLS), { institutionId: centre })).toBeNull();
    expect(enrolmentBlocker(youth(Pillar.INCUBATION), { institutionId: centre })).toBe(
      'Only Digital and Creative Talent Development youth can join this cohort',
    );
  });

  it('names the programme when youth from another programme are added', () => {
    expect(enrolmentBlocker(youth(Pillar.SKILLS), { institutionId: centre, pillar: Pillar.INCUBATION })).toBe(
      'Only Startup Incubation youth can join this cohort',
    );
    expect(enrolmentBlocker(youth(Pillar.INCUBATION), { institutionId: centre, pillar: Pillar.ACCELERATION })).toBe(
      'Only Enterprise Acceleration youth can join this cohort',
    );
  });

  it('still requires allocation to the same centre', () => {
    expect(
      enrolmentBlocker(youth(Pillar.SKILLS, { status: BeneficiaryStatus.SUBMITTED }), {
        institutionId: centre,
        pillar: Pillar.SKILLS,
      }),
    ).toBe('Beneficiary has not been allocated to a Centre of Excellence');
    expect(
      enrolmentBlocker(youth(Pillar.SKILLS, { assignedInstitutionId: 'centre-b' }), {
        institutionId: centre,
        pillar: Pillar.SKILLS,
      }),
    ).toBe('Beneficiary is allocated to a different institution');
  });
});

describe('recordsProgress', () => {
  it('records completion only for Talent Development cohorts', () => {
    expect(recordsProgress(Pillar.SKILLS)).toBe(true);
    expect(recordsProgress(undefined)).toBe(true);
    expect(recordsProgress(Pillar.INCUBATION)).toBe(false);
    expect(recordsProgress(Pillar.ACCELERATION)).toBe(false);
  });
});
