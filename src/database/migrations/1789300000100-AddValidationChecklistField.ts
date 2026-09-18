import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hand-written (no database connection available to run `db:migration:generate` in this
 * environment) — diff against a real generated migration before applying.
 *
 * The field-visit checklist (5 items: location, staff, operational activity, reputation,
 * delivery history) previously existed only in the frontend and was flattened into the
 * `siteInspectionNotes` free-text column via buildSiteInspectionNotes(). This adds a real
 * structured column so the checklist is queryable/reportable, matching the way the
 * eligibility module already stores its checklist as structured rows rather than text.
 */
export class AddValidationChecklistField1789300000100
  implements MigrationInterface
{
  name = 'AddValidationChecklistField1789300000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "validation_records"
      ADD "checklist" jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "validation_records"
      DROP COLUMN "checklist";
    `);
  }
}
