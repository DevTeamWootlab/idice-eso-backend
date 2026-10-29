import { MigrationInterface, QueryRunner } from 'typeorm';

export class BeneficiaryPrdForm1791000000000 implements MigrationInterface {
  name = 'BeneficiaryPrdForm1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "beneficiaries" ADD COLUMN IF NOT EXISTS "firstName" character varying`);
    await queryRunner.query(`ALTER TABLE "beneficiaries" ADD COLUMN IF NOT EXISTS "middleName" character varying`);
    await queryRunner.query(`ALTER TABLE "beneficiaries" ADD COLUMN IF NOT EXISTS "lastName" character varying`);
    await queryRunner.query(`ALTER TABLE "beneficiaries" ADD COLUMN IF NOT EXISTS "studentLevel" character varying`);
    await queryRunner.query(
      `ALTER TABLE "beneficiaries" ADD COLUMN IF NOT EXISTS "informationAccurateConfirmed" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "beneficiaries" ADD COLUMN IF NOT EXISTS "falseInformationAcknowledged" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "beneficiaries" ADD COLUMN IF NOT EXISTS "signatureName" character varying`);

    await queryRunner.query(
      `ALTER TABLE "beneficiary_incubation_profiles" ALTER COLUMN "currentStage" TYPE character varying USING "currentStage"::text`,
    );
    await queryRunner.query(`ALTER TABLE "beneficiary_incubation_profiles" ADD COLUMN IF NOT EXISTS "details" jsonb`);

    await queryRunner.query(`ALTER TABLE "beneficiary_acceleration_profiles" ALTER COLUMN "cacRegistrationNumber" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "beneficiary_acceleration_profiles" ALTER COLUMN "yearFounded" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "beneficiary_acceleration_profiles" ALTER COLUMN "primaryGrowthChallenge" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "beneficiary_acceleration_profiles" ADD COLUMN IF NOT EXISTS "details" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "beneficiary_acceleration_profiles" DROP COLUMN IF EXISTS "details"`);
    await queryRunner.query(
      `UPDATE "beneficiary_acceleration_profiles" SET "primaryGrowthChallenge" = '' WHERE "primaryGrowthChallenge" IS NULL`,
    );
    await queryRunner.query(`UPDATE "beneficiary_acceleration_profiles" SET "yearFounded" = 0 WHERE "yearFounded" IS NULL`);
    await queryRunner.query(
      `UPDATE "beneficiary_acceleration_profiles" SET "cacRegistrationNumber" = 'NONE-' || "id" WHERE "cacRegistrationNumber" IS NULL`,
    );
    await queryRunner.query(`ALTER TABLE "beneficiary_acceleration_profiles" ALTER COLUMN "primaryGrowthChallenge" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "beneficiary_acceleration_profiles" ALTER COLUMN "yearFounded" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "beneficiary_acceleration_profiles" ALTER COLUMN "cacRegistrationNumber" SET NOT NULL`);

    await queryRunner.query(`ALTER TABLE "beneficiary_incubation_profiles" DROP COLUMN IF EXISTS "details"`);
    await queryRunner.query(
      `UPDATE "beneficiary_incubation_profiles" SET "currentStage" = CASE
         WHEN "currentStage" IN ('IDEA', 'CONCEPT', 'EARLY_PROTOTYPE') THEN "currentStage"
         WHEN "currentStage" = 'Idea Stage' THEN 'IDEA'
         WHEN "currentStage" = 'Concept / Problem Validation' THEN 'CONCEPT'
         ELSE 'EARLY_PROTOTYPE' END`,
    );
    await queryRunner.query(
      `ALTER TABLE "beneficiary_incubation_profiles" ALTER COLUMN "currentStage" TYPE "public"."beneficiary_incubation_profiles_currentstage_enum" USING "currentStage"::"public"."beneficiary_incubation_profiles_currentstage_enum"`,
    );

    await queryRunner.query(`ALTER TABLE "beneficiaries" DROP COLUMN IF EXISTS "signatureName"`);
    await queryRunner.query(`ALTER TABLE "beneficiaries" DROP COLUMN IF EXISTS "falseInformationAcknowledged"`);
    await queryRunner.query(`ALTER TABLE "beneficiaries" DROP COLUMN IF EXISTS "informationAccurateConfirmed"`);
    await queryRunner.query(`ALTER TABLE "beneficiaries" DROP COLUMN IF EXISTS "studentLevel"`);
    await queryRunner.query(`ALTER TABLE "beneficiaries" DROP COLUMN IF EXISTS "lastName"`);
    await queryRunner.query(`ALTER TABLE "beneficiaries" DROP COLUMN IF EXISTS "middleName"`);
    await queryRunner.query(`ALTER TABLE "beneficiaries" DROP COLUMN IF EXISTS "firstName"`);
  }
}
