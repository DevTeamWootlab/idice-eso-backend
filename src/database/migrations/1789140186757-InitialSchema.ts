import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1789140186757 implements MigrationInterface {
    name = 'InitialSchema1789140186757'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "score_cards" DROP COLUMN "reviewerSlot"`);
        await queryRunner.query(`DROP TYPE "public"."score_cards_reviewerslot_enum"`);
        await queryRunner.query(`ALTER TABLE "score_cards" ADD "reviewerSlot" integer NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "score_cards" DROP COLUMN "reviewerSlot"`);
        await queryRunner.query(`CREATE TYPE "public"."score_cards_reviewerslot_enum" AS ENUM('REVIEWER_ONE', 'REVIEWER_TWO')`);
        await queryRunner.query(`ALTER TABLE "score_cards" ADD "reviewerSlot" "public"."score_cards_reviewerslot_enum" NOT NULL`);
    }

}
