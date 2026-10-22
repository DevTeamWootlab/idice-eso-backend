import { MigrationInterface, QueryRunner } from 'typeorm';

export class BeneficiaryGoogleFormFields1790800000000 implements MigrationInterface {
  name = 'BeneficiaryGoogleFormFields1790800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "beneficiaries" ADD COLUMN IF NOT EXISTS "ageBracket" character varying`);
    await queryRunner.query(`ALTER TABLE "beneficiaries" ADD COLUMN IF NOT EXISTS "commitmentHoursConfirmed" boolean`);
    await queryRunner.query(`ALTER TABLE "beneficiaries" ADD COLUMN IF NOT EXISTS "governmentIdStorageKey" character varying`);
    await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" ADD COLUMN IF NOT EXISTS "focusArea" character varying`);
    await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" ADD COLUMN IF NOT EXISTS "preferredSkill" character varying`);
    await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" ADD COLUMN IF NOT EXISTS "experienceLevel" character varying`);
    await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" ADD COLUMN IF NOT EXISTS "knowledgeRating" smallint`);
    await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" ADD COLUMN IF NOT EXISTS "coursesTaken" text array`);
    await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" ADD COLUMN IF NOT EXISTS "confidenceRating" smallint`);
    await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" ADD COLUMN IF NOT EXISTS "practicalApplication" character varying`);
    await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" ADD COLUMN IF NOT EXISTS "independence" character varying`);
    await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" ADD COLUMN IF NOT EXISTS "deliveryFormat" character varying`);
    await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" ADD COLUMN IF NOT EXISTS "hasSmartphone" boolean`);
    await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" ADD COLUMN IF NOT EXISTS "hasBackupPower" boolean`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" DROP COLUMN IF EXISTS "hasBackupPower"`);
    await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" DROP COLUMN IF EXISTS "hasSmartphone"`);
    await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" DROP COLUMN IF EXISTS "deliveryFormat"`);
    await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" DROP COLUMN IF EXISTS "independence"`);
    await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" DROP COLUMN IF EXISTS "practicalApplication"`);
    await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" DROP COLUMN IF EXISTS "confidenceRating"`);
    await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" DROP COLUMN IF EXISTS "coursesTaken"`);
    await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" DROP COLUMN IF EXISTS "knowledgeRating"`);
    await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" DROP COLUMN IF EXISTS "experienceLevel"`);
    await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" DROP COLUMN IF EXISTS "preferredSkill"`);
    await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" DROP COLUMN IF EXISTS "focusArea"`);
    await queryRunner.query(`ALTER TABLE "beneficiaries" DROP COLUMN IF EXISTS "governmentIdStorageKey"`);
    await queryRunner.query(`ALTER TABLE "beneficiaries" DROP COLUMN IF EXISTS "commitmentHoursConfirmed"`);
    await queryRunner.query(`ALTER TABLE "beneficiaries" DROP COLUMN IF EXISTS "ageBracket"`);
  }
}
