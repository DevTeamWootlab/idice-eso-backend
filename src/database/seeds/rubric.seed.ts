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

/**
 * Inserts any missing rubric dimension with its PRD default weight.
 *
 * Deliberately does NOT overwrite existing rows: administrators can edit the weights
 * (until scoring starts), and this seed runs on every deploy (`deploy:prod`), so an
 * upsert here would silently reset their changes.
 */
export async function seedRubric(manager: EntityManager): Promise<void> {
  const repository = manager.getRepository(RubricConfiguration);

  for (const [dimensionCode, label, weightPercentage] of dimensions) {
    await repository
      .createQueryBuilder()
      .insert()
      .values({ dimensionCode, label, weightPercentage, isActive: true })
      .orIgnore()
      .execute();
  }
}
