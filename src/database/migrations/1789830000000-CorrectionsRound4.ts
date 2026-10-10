import { MigrationInterface, QueryRunner } from 'typeorm';


export class CorrectionsRound41789830000000 implements MigrationInterface {
  name = 'CorrectionsRound41789830000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- essential: the columns the entities now select --------------------------------------
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "scoringSlot" smallint`);
    await queryRunner.query(`ALTER TABLE "beneficiaries" ADD COLUMN IF NOT EXISTS "academicStatus" character varying`);
    await queryRunner.query(`ALTER TABLE "beneficiaries" ADD COLUMN IF NOT EXISTS "allocatedAt" TIMESTAMP WITH TIME ZONE`);

    // ---- best-effort: never allowed to undo the columns above --------------------------------
    // Backfill so the PCU period filter still works for youth allocated before the column existed.
    await queryRunner.query(`
      DO $$ BEGIN
        UPDATE "beneficiaries" SET "allocatedAt" = "created_at"
        WHERE "allocatedAt" IS NULL AND "status"::text = 'ALLOCATED';
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'allocatedAt backfill skipped: %', SQLERRM;
      END $$;`);

    // Backup codes are a JSON array of hashes. On a database created when the column was plain text
    // the codes could never be read back, so no backup code ever matched. Convert it; the unreadable
    // codes are discarded and each person can generate new ones. A no-op when it is already jsonb.
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'mfa_secrets' AND column_name = 'backupCodes' AND data_type <> 'jsonb') THEN
          ALTER TABLE "mfa_secrets" ALTER COLUMN "backupCodes" DROP DEFAULT;
          ALTER TABLE "mfa_secrets" ALTER COLUMN "backupCodes" TYPE jsonb USING '[]'::jsonb;
          ALTER TABLE "mfa_secrets" ALTER COLUMN "backupCodes" SET DEFAULT '[]'::jsonb;
        END IF;
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'backupCodes conversion skipped: %', SQLERRM;
      END $$;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "beneficiaries" DROP COLUMN IF EXISTS "allocatedAt"`);
    await queryRunner.query(`ALTER TABLE "beneficiaries" DROP COLUMN IF EXISTS "academicStatus"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "scoringSlot"`);
  }
}
