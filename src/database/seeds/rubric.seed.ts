import { EntityManager } from 'typeorm';
import { RubricConfiguration } from '@modules/scoring/entities/rubric-configuration.entity';

const dimensions = [
  ['LOCAL_PRESENCE', 'Local Presence & Relevance to State Ecosystem', 20],
  ['TEAM_EXPERTISE', 'Strong Team Expertise', 20],
  ['INCUBATION_EXPERIENCE', 'Startup Incubation, Acceleration & Business Development Experience', 15],
  ['GOVERNANCE_COMPLIANCE', 'ESO Credibility, Governance & Compliance', 15],
  ['DELIVERY_TRACK_RECORD', 'Programme Delivery Track Record', 15],
  ['INSTITUTIONAL_ALIGNMENT', 'Institutional Relationship & Alignment with Host Institution Needs', 15],
] as const;

export async function seedRubric(manager: EntityManager): Promise<void> {
  const repository = manager.getRepository(RubricConfiguration);

  for (const [dimensionCode, label, weightPercentage] of dimensions) {
    await repository.upsert(
      { dimensionCode, label, weightPercentage, isActive: true },
      ['dimensionCode'],
    );
  }
}
