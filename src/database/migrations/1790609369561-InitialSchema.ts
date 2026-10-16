import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1790609369561 implements MigrationInterface {
    name = 'InitialSchema1790609369561'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "in_app_notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', "userId" character varying NOT NULL, "title" character varying NOT NULL, "message" text NOT NULL, "href" character varying, "readAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_f871e2a23724692bbb5b3b75c98" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_6cd5283182ba7eca72722e7d15" ON "in_app_notifications"  ("userId", "readAt") `);
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "scoringSlot" smallint`);
        await queryRunner.query(`ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "scoringIntegrityError" text`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ADD COLUMN IF NOT EXISTS "academicStatus" character varying`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ADD COLUMN IF NOT EXISTS "allocatedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "score_cards" ALTER COLUMN "credibilityGovernanceScore" DROP DEFAULT`);
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
                    WHERE t.typname = 'applications_statesofoperation_enum' AND e.enumlabel = 'JOS'
                ) THEN
                    UPDATE "applications"
                    SET "statesOfOperation" = ARRAY(
                        SELECT DISTINCT unnest(array_replace("statesOfOperation", 'JOS'::"public"."applications_statesofoperation_enum", 'PLATEAU'::"public"."applications_statesofoperation_enum"))
                    )
                    WHERE 'JOS'::"public"."applications_statesofoperation_enum" = ANY("statesOfOperation");
                    ALTER TYPE "public"."applications_statesofoperation_enum" RENAME TO "applications_statesofoperation_enum_old";
                    CREATE TYPE "public"."applications_statesofoperation_enum" AS ENUM('BENUE', 'KOGI', 'KWARA', 'NASARAWA', 'NIGER', 'PLATEAU', 'FCT');
                    ALTER TABLE "applications" ALTER COLUMN "statesOfOperation" TYPE "public"."applications_statesofoperation_enum"[] USING "statesOfOperation"::"text"::"public"."applications_statesofoperation_enum"[];
                    DROP TYPE "public"."applications_statesofoperation_enum_old";
                END IF;
            END $$;`);
        await queryRunner.query(`ALTER TYPE "public"."cohorts_status_enum" ADD VALUE IF NOT EXISTS 'PAUSED'`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_114fed40a5da550ce2e7e8bbbc"`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_114fed40a5da550ce2e7e8bbbc" ON "cohorts"  ("institutionId", "status") `);
    }

    public async down(): Promise<void> {
        return;
    }

}
