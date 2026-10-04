import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1789122143474 implements MigrationInterface {
    name = 'InitialSchema1789122143474'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "score_cards" ADD "compositePercentage" numeric(5,2) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "score_cards" ADD "submitted" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "courses" DROP CONSTRAINT "UQ_ee82d2848683925681f8c79a253"`);
        await queryRunner.query(`ALTER TABLE "courses" ALTER COLUMN "tier" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "courses" ADD CONSTRAINT "UQ_ee82d2848683925681f8c79a253" UNIQUE ("title", "tier")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "courses" DROP CONSTRAINT "UQ_ee82d2848683925681f8c79a253"`);
        await queryRunner.query(`ALTER TABLE "courses" ALTER COLUMN "tier" SET DEFAULT 'FOUNDATIONAL'`);
        await queryRunner.query(`ALTER TABLE "courses" ADD CONSTRAINT "UQ_ee82d2848683925681f8c79a253" UNIQUE ("title", "tier")`);
        await queryRunner.query(`ALTER TABLE "score_cards" DROP COLUMN "submitted"`);
        await queryRunner.query(`ALTER TABLE "score_cards" DROP COLUMN "compositePercentage"`);
    }

}
