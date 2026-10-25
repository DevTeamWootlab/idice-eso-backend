import { MigrationInterface, QueryRunner } from 'typeorm';

export class MonthlyReports1790900000000 implements MigrationInterface {
  name = 'MonthlyReports1790900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "monthly_reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', "applicationId" uuid NOT NULL, "institutionId" uuid NOT NULL, "reportMonth" character varying(7) NOT NULL, "fileUrl" character varying NOT NULL, "fileName" character varying NOT NULL, "submittedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "submittedById" uuid NOT NULL, CONSTRAINT "PK_monthly_reports_id" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_monthly_reports_application_month" ON "monthly_reports" ("applicationId", "reportMonth")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_monthly_reports_application_month"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "monthly_reports"`);
  }
}
