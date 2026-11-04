import { MigrationInterface, QueryRunner } from "typeorm";

export class AddManualAssignment1793769973452 implements MigrationInterface {
    name = 'AddManualAssignment1793769973452'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_in_app_notifications_user_read"`);
        await queryRunner.query(`CREATE TYPE "public"."matches_source_enum" AS ENUM('SYSTEM', 'MANUAL')`);
        await queryRunner.query(`ALTER TABLE "matches" ADD "source" "public"."matches_source_enum" NOT NULL DEFAULT 'SYSTEM'`);
        await queryRunner.query(`ALTER TABLE "matches" ADD "overriddenApplicationId" uuid`);
        await queryRunner.query(`ALTER TABLE "matches" ADD "overrideReason" text`);
        await queryRunner.query(`ALTER TABLE "matches" ADD "assignedByUserId" uuid`);
        await queryRunner.query(`ALTER TYPE "public"."matches_status_enum" ADD VALUE 'AWAITING_APPROVAL'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."matches_status_enum_old" AS ENUM('GENERATED', 'ACCEPTED', 'REJECTED')`);
        await queryRunner.query(`ALTER TABLE "matches" ALTER COLUMN "status" TYPE "public"."matches_status_enum_old" USING "status"::"text"::"public"."matches_status_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."matches_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."matches_status_enum_old" RENAME TO "matches_status_enum"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "assignedByUserId"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "overrideReason"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "overriddenApplicationId"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "source"`);
        await queryRunner.query(`DROP TYPE "public"."matches_source_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_in_app_notifications_user_read" ON "in_app_notifications" USING btree ("userId", "readAt") `);
    }

}
