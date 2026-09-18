import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B6 — OperatingState previously contained both PLATEAU and JOS (Jos is a city inside
 * Plateau State, not a distinct state). Confirmed against the Supabase seed export
 * (ESO-tables/eso_applications_rows.csv) that no application row ever used "JOS" as a
 * structured state value — only "Plateau" appears in stateOfOperation/statesOfOperation,
 * with "Jos" occurring solely inside free-text address fields. This migration is
 * nonetheless defensive: it maps any stray JOS value to PLATEAU (de-duplicating the
 * array) before narrowing the enum type, in case the live database has rows this CSV
 * snapshot does not reflect.
 */
export class RemoveJosOperatingState1789200000000 implements MigrationInterface {
  name = 'RemoveJosOperatingState1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Defensive data cleanup: replace any 'JOS' entries with 'PLATEAU' and
    //    de-duplicate the array, so no row can be left holding a value the narrowed
    //    enum type won't accept.
    await queryRunner.query(`
      UPDATE "applications"
      SET "statesOfOperation" = (
        SELECT array_agg(DISTINCT elem ORDER BY elem)
        FROM unnest(array_replace("statesOfOperation"::text[], 'JOS', 'PLATEAU')) AS elem
      )::text[]::"public"."applications_statesofoperation_enum"[]
      WHERE "statesOfOperation" IS NOT NULL
        AND 'JOS' = ANY ("statesOfOperation"::text[]);
    `);

    // 2. Recreate the enum type without JOS (Postgres has no ALTER TYPE ... DROP VALUE).
    await queryRunner.query(`
      CREATE TYPE "public"."applications_statesofoperation_enum_new" AS ENUM(
        'BENUE', 'KOGI', 'KWARA', 'NASARAWA', 'NIGER', 'PLATEAU', 'FCT'
      );
    `);

    await queryRunner.query(`
      ALTER TABLE "applications"
      ALTER COLUMN "statesOfOperation" TYPE "public"."applications_statesofoperation_enum_new"[]
      USING "statesOfOperation"::text[]::"public"."applications_statesofoperation_enum_new"[];
    `);

    await queryRunner.query(`DROP TYPE "public"."applications_statesofoperation_enum";`);
    await queryRunner.query(`
      ALTER TYPE "public"."applications_statesofoperation_enum_new"
      RENAME TO "applications_statesofoperation_enum";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Schema-only reversal — does not attempt to restore any JOS values that were
    // remapped to PLATEAU in up(), since that mapping is not reversible without the
    // original data.
    await queryRunner.query(`
      CREATE TYPE "public"."applications_statesofoperation_enum_old" AS ENUM(
        'BENUE', 'KOGI', 'KWARA', 'NASARAWA', 'NIGER', 'JOS', 'PLATEAU', 'FCT'
      );
    `);

    await queryRunner.query(`
      ALTER TABLE "applications"
      ALTER COLUMN "statesOfOperation" TYPE "public"."applications_statesofoperation_enum_old"[]
      USING "statesOfOperation"::text[]::"public"."applications_statesofoperation_enum_old"[];
    `);

    await queryRunner.query(`DROP TYPE "public"."applications_statesofoperation_enum";`);
    await queryRunner.query(`
      ALTER TYPE "public"."applications_statesofoperation_enum_old"
      RENAME TO "applications_statesofoperation_enum";
    `);
  }
}
