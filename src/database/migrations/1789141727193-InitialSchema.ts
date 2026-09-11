import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1789141727193 implements MigrationInterface {
    name = 'InitialSchema1789141727193'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "score_cards" DROP COLUMN "credibilityGovernanceScore"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "score_cards" ADD "credibilityGovernanceScore" smallint NOT NULL`);
    }

}
