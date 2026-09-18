import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hand-written (not generated via `db:migration:generate` — no database connection was
 * available in the environment this was authored in). Please diff this against a real
 * `migration:generate` run before applying to a shared database.
 *
 * Adds the fields needed to actually persist a scoring outcome on the Application row:
 * - `finalScorePercent` / `scoreVarianceFlagged` — previously computed in
 *   ScoringService.tryFinalize() but only ever returned in the HTTP response, never
 *   saved, so nobody could see the final score after the fact.
 * - `scoreVarianceResolutionNote` / `scoreVarianceResolvedByUserId` / `scoreVarianceResolvedAt`
 *   — new fields for the Validator/Lead Evaluator's >15%-variance reconciliation.
 * - `matchedAt` — set when the Partner Match Engine matches this application.
 */
export class AddScoringResolutionAndMatchFields1789300000000
  implements MigrationInterface
{
  name = 'AddScoringResolutionAndMatchFields1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "applications"
      ADD "finalScorePercent" numeric(5,2),
      ADD "scoreVarianceFlagged" boolean NOT NULL DEFAULT false,
      ADD "scoreVarianceResolutionNote" text,
      ADD "scoreVarianceResolvedByUserId" uuid,
      ADD "scoreVarianceResolvedAt" TIMESTAMP WITH TIME ZONE,
      ADD "matchedAt" TIMESTAMP WITH TIME ZONE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "applications"
      DROP COLUMN "matchedAt",
      DROP COLUMN "scoreVarianceResolvedAt",
      DROP COLUMN "scoreVarianceResolvedByUserId",
      DROP COLUMN "scoreVarianceResolutionNote",
      DROP COLUMN "scoreVarianceFlagged",
      DROP COLUMN "finalScorePercent";
    `);
  }
}
