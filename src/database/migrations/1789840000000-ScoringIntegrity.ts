import { MigrationInterface, QueryRunner } from 'typeorm';

export class ScoringIntegrity1789840000000 implements MigrationInterface {
  name = 'ScoringIntegrity1789840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "scoringIntegrityError" text`);

    await queryRunner.query(`
      DO $$ BEGIN
        UPDATE "applications" a
        SET "scoringIntegrityError" = 'Rejected by the scoring gate with an invalid final score (NaN). Review the score cards and correct.'
        WHERE a."status"::text = 'REJECTED'
          AND a."scoringIntegrityError" IS NULL
          AND (a."finalScorePercent" IS NULL OR a."finalScorePercent" = 'NaN'::numeric)
          AND EXISTS (
            SELECT 1 FROM "audit_logs" l
            WHERE l."entityType" = 'Application'
              AND l."entityId" = a."id"::text
              AND l."action" = 'SCORE_FINALIZED_REJECTED'
          );
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'scoring integrity flagging skipped: %', SQLERRM;
      END $$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN IF EXISTS "scoringIntegrityError"`);
  }
}
