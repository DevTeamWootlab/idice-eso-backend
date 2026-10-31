import { MigrationInterface, QueryRunner } from 'typeorm';

export class MonthlyReportNil1791100000000 implements MigrationInterface {
  name = 'MonthlyReportNil1791100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "monthly_reports" ALTER COLUMN "fileUrl" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "monthly_reports" ALTER COLUMN "fileName" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "monthly_reports" ADD COLUMN IF NOT EXISTS "isNil" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "monthly_reports" ADD COLUMN IF NOT EXISTS "beneficiaryCount" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "monthly_reports" WHERE "fileUrl" IS NULL OR "fileName" IS NULL`);
    await queryRunner.query(`ALTER TABLE "monthly_reports" DROP COLUMN IF EXISTS "beneficiaryCount"`);
    await queryRunner.query(`ALTER TABLE "monthly_reports" DROP COLUMN IF EXISTS "isNil"`);
    await queryRunner.query(`ALTER TABLE "monthly_reports" ALTER COLUMN "fileName" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "monthly_reports" ALTER COLUMN "fileUrl" SET NOT NULL`);
  }
}
