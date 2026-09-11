import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1789142207500 implements MigrationInterface {
    name = 'InitialSchema1789142207500'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "score_cards" ALTER COLUMN "institutionalAlignmentScore" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "score_cards" ALTER COLUMN "compositeScore" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "score_cards" ALTER COLUMN "compositeScore" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "score_cards" ALTER COLUMN "institutionalAlignmentScore" SET NOT NULL`);
    }

}
