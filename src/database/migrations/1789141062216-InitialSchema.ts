import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1789141062216 implements MigrationInterface {
    name = 'InitialSchema1789141062216'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "score_cards" RENAME COLUMN "governanceComplianceScore" TO "credibilityGovernanceScore"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "score_cards" RENAME COLUMN "credibilityGovernanceScore" TO "governanceComplianceScore"`);
    }

}
