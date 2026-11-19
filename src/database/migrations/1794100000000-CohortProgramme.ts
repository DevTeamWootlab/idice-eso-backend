import { MigrationInterface, QueryRunner } from 'typeorm';

export class CohortProgramme1794100000000 implements MigrationInterface {
  name = 'CohortProgramme1794100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."cohorts_pillar_enum" AS ENUM('SKILLS', 'INCUBATION', 'ACCELERATION');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(
      `ALTER TABLE "cohorts" ADD COLUMN IF NOT EXISTS "pillar" "public"."cohorts_pillar_enum" NOT NULL DEFAULT 'SKILLS'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows: { count: string }[] = await queryRunner.query(
      `SELECT COUNT(*)::text AS count FROM "cohorts" WHERE "pillar" <> 'SKILLS'`,
    );
    if (Number(rows[0]?.count ?? 0) > 0) {
      throw new Error(
        'Cannot revert: Startup Incubation or Enterprise Acceleration cohorts exist. Remove them before reverting this migration.',
      );
    }
    await queryRunner.query(`ALTER TABLE "cohorts" DROP COLUMN IF EXISTS "pillar"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."cohorts_pillar_enum"`);
  }
}
