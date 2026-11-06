import { MigrationInterface, QueryRunner } from 'typeorm';

export class OneEsoManyCentres1793900000000 implements MigrationInterface {
  name = 'OneEsoManyCentres1793900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "matches" DROP CONSTRAINT IF EXISTS "REL_5eb55afa42477e208143d5a920"`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_matches_applicationId" ON "matches" ("applicationId")`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_monthly_reports_application_month"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_monthly_reports_application_institution_month" ON "monthly_reports" ("applicationId", "institutionId", "reportMonth")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const sharedMatches: unknown[] = await queryRunner.query(
      `SELECT "applicationId" FROM "matches" GROUP BY "applicationId" HAVING COUNT(*) > 1`,
    );
    if (sharedMatches.length > 0) {
      throw new Error(
        `Cannot revert: ${sharedMatches.length} ESO(s) are paired with more than one Centre of Excellence. Remove the extra pairings first.`,
      );
    }
    const sharedReports: unknown[] = await queryRunner.query(
      `SELECT "applicationId" FROM "monthly_reports" GROUP BY "applicationId", "reportMonth" HAVING COUNT(*) > 1`,
    );
    if (sharedReports.length > 0) {
      throw new Error(
        `Cannot revert: ${sharedReports.length} ESO month(s) have reports for more than one Centre of Excellence. Remove the extra reports first.`,
      );
    }
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_monthly_reports_application_institution_month"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_monthly_reports_application_month" ON "monthly_reports" ("applicationId", "reportMonth")`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_matches_applicationId"`);
    await queryRunner.query(
      `ALTER TABLE "matches" ADD CONSTRAINT "REL_5eb55afa42477e208143d5a920" UNIQUE ("applicationId")`,
    );
  }
}
