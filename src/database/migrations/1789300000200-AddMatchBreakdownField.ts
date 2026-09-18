import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hand-written (no database connection available in this environment to run
 * `db:migration:generate`) — diff against a real generated migration before applying.
 *
 * Persists the three named Match Compatibility Index components (hub alignment,
 * capacity, institutional relationship — see MatchingService.computeMci) alongside
 * the final matchCompatibilityIndex, so the admin UI can show the breakdown that
 * actually produced a given match rather than recomputing it later against data that
 * may have changed since.
 */
export class AddMatchBreakdownField1789300000200 implements MigrationInterface {
  name = 'AddMatchBreakdownField1789300000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "matches"
      ADD "breakdown" jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "matches"
      DROP COLUMN "breakdown";
    `);
  }
}
