import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1789742461090 implements MigrationInterface {
    name = 'InitialSchema1789742461090'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "score_cards" ADD "credibilityGovernanceScore" smallint NOT NULL`);
        await queryRunner.query(`ALTER TABLE "applications" ADD "finalScorePercent" numeric(5,2)`);
        await queryRunner.query(`ALTER TABLE "applications" ADD "scoreVarianceFlagged" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "applications" ADD "scoreVarianceResolutionNote" text`);
        await queryRunner.query(`ALTER TABLE "applications" ADD "scoreVarianceResolvedByUserId" character varying`);
        await queryRunner.query(`ALTER TABLE "applications" ADD "scoreVarianceResolvedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "applications" ADD "matchedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "matches" ADD "breakdown" jsonb`);
        await queryRunner.query(`ALTER TABLE "validation_records" ADD "checklist" jsonb`);
        await queryRunner.query(`ALTER TYPE "public"."applications_statesofoperation_enum" RENAME TO "applications_statesofoperation_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."applications_statesofoperation_enum" AS ENUM('BENUE', 'KOGI', 'KWARA', 'NASARAWA', 'NIGER', 'PLATEAU', 'FCT')`);
        await queryRunner.query(`ALTER TABLE "applications" ALTER COLUMN "statesOfOperation" TYPE "public"."applications_statesofoperation_enum"[] USING "statesOfOperation"::"text"::"public"."applications_statesofoperation_enum"[]`);
        await queryRunner.query(`DROP TYPE "public"."applications_statesofoperation_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."applications_statesofoperation_enum_old" AS ENUM('BENUE', 'KOGI', 'KWARA', 'NASARAWA', 'NIGER', 'JOS', 'PLATEAU', 'FCT')`);
        await queryRunner.query(`ALTER TABLE "applications" ALTER COLUMN "statesOfOperation" TYPE "public"."applications_statesofoperation_enum_old"[] USING "statesOfOperation"::"text"::"public"."applications_statesofoperation_enum_old"[]`);
        await queryRunner.query(`DROP TYPE "public"."applications_statesofoperation_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."applications_statesofoperation_enum_old" RENAME TO "applications_statesofoperation_enum"`);
        await queryRunner.query(`ALTER TABLE "validation_records" DROP COLUMN "checklist"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "breakdown"`);
        await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN "matchedAt"`);
        await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN "scoreVarianceResolvedAt"`);
        await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN "scoreVarianceResolvedByUserId"`);
        await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN "scoreVarianceResolutionNote"`);
        await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN "scoreVarianceFlagged"`);
        await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN "finalScorePercent"`);
        await queryRunner.query(`ALTER TABLE "score_cards" DROP COLUMN "credibilityGovernanceScore"`);
    }

}
