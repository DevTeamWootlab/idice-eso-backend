import { MigrationInterface, QueryRunner } from 'typeorm';

export class BeneficiaryFormRevision1790700000000 implements MigrationInterface {
  name = 'BeneficiaryFormRevision1790700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "beneficiaries" ADD COLUMN IF NOT EXISTS "employmentStatus" character varying`);
    await queryRunner.query(`ALTER TABLE "beneficiaries" ADD COLUMN IF NOT EXISTS "highestEducationLevel" character varying`);
    await queryRunner.query(`
      UPDATE "beneficiaries" b
      SET "highestEducationLevel" = s."highestEducationLevel"
      FROM "beneficiary_skills_profiles" s
      WHERE s."beneficiaryId"::text = b."id"::text
        AND b."highestEducationLevel" IS NULL
        AND s."highestEducationLevel" IS NOT NULL`);
    await queryRunner.query(`ALTER TABLE "beneficiary_acceleration_profiles" ADD COLUMN IF NOT EXISTS "developmentStage" character varying`);
    await queryRunner.query(`ALTER TABLE "beneficiary_acceleration_profiles" ADD COLUMN IF NOT EXISTS "teamSize" integer`);
    await queryRunner.query(`ALTER TABLE "beneficiary_acceleration_profiles" ADD COLUMN IF NOT EXISTS "cacDocumentStorageKey" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "beneficiary_acceleration_profiles" DROP COLUMN IF EXISTS "cacDocumentStorageKey"`);
    await queryRunner.query(`ALTER TABLE "beneficiary_acceleration_profiles" DROP COLUMN IF EXISTS "teamSize"`);
    await queryRunner.query(`ALTER TABLE "beneficiary_acceleration_profiles" DROP COLUMN IF EXISTS "developmentStage"`);
    await queryRunner.query(`ALTER TABLE "beneficiaries" DROP COLUMN IF EXISTS "highestEducationLevel"`);
    await queryRunner.query(`ALTER TABLE "beneficiaries" DROP COLUMN IF EXISTS "employmentStatus"`);
  }
}
