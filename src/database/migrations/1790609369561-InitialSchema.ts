import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1790609369561 implements MigrationInterface {
    name = 'InitialSchema1790609369561'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "in_app_notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', "userId" character varying NOT NULL, "title" character varying NOT NULL, "message" text NOT NULL, "href" character varying, "readAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_f871e2a23724692bbb5b3b75c98" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6cd5283182ba7eca72722e7d15" ON "in_app_notifications"  ("userId", "readAt") `);
        await queryRunner.query(`ALTER TABLE "users" ADD "scoringSlot" smallint`);
        await queryRunner.query(`ALTER TABLE "applications" ADD "scoringIntegrityError" text`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ADD "academicStatus" character varying`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ADD "allocatedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "score_cards" ALTER COLUMN "credibilityGovernanceScore" DROP DEFAULT`);
        await queryRunner.query(`ALTER TYPE "public"."applications_statesofoperation_enum" RENAME TO "applications_statesofoperation_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."applications_statesofoperation_enum" AS ENUM('BENUE', 'KOGI', 'KWARA', 'NASARAWA', 'NIGER', 'PLATEAU', 'FCT')`);
        await queryRunner.query(`ALTER TABLE "applications" ALTER COLUMN "statesOfOperation" TYPE "public"."applications_statesofoperation_enum"[] USING "statesOfOperation"::"text"::"public"."applications_statesofoperation_enum"[]`);
        await queryRunner.query(`DROP TYPE "public"."applications_statesofoperation_enum_old"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_114fed40a5da550ce2e7e8bbbc"`);
        await queryRunner.query(`ALTER TYPE "public"."cohorts_status_enum" ADD VALUE 'PAUSED'`);
        await queryRunner.query(`CREATE INDEX "IDX_114fed40a5da550ce2e7e8bbbc" ON "cohorts"  ("institutionId", "status") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_114fed40a5da550ce2e7e8bbbc"`);
        await queryRunner.query(`CREATE TYPE "public"."cohorts_status_enum_old" AS ENUM('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "cohorts" ALTER COLUMN "status" TYPE "public"."cohorts_status_enum_old" USING "status"::"text"::"public"."cohorts_status_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."cohorts_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."cohorts_status_enum_old" RENAME TO "cohorts_status_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_114fed40a5da550ce2e7e8bbbc" ON "cohorts" USING btree ("institutionId", "status") `);
        await queryRunner.query(`CREATE TYPE "public"."applications_statesofoperation_enum_old" AS ENUM('BENUE', 'KOGI', 'KWARA', 'NASARAWA', 'NIGER', 'JOS', 'PLATEAU', 'FCT')`);
        await queryRunner.query(`ALTER TABLE "applications" ALTER COLUMN "statesOfOperation" TYPE "public"."applications_statesofoperation_enum_old"[] USING "statesOfOperation"::"text"::"public"."applications_statesofoperation_enum_old"[]`);
        await queryRunner.query(`DROP TYPE "public"."applications_statesofoperation_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."applications_statesofoperation_enum_old" RENAME TO "applications_statesofoperation_enum"`);
        await queryRunner.query(`ALTER TABLE "score_cards" ALTER COLUMN "credibilityGovernanceScore" SET DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" DROP COLUMN "allocatedAt"`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" DROP COLUMN "academicStatus"`);
        await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN "scoringIntegrityError"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "scoringSlot"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6cd5283182ba7eca72722e7d15"`);
        await queryRunner.query(`DROP TABLE "in_app_notifications"`);
    }

}
