import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1789131630777 implements MigrationInterface {
    name = 'InitialSchema1789131630777'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mfa_secrets" DROP COLUMN "backupCodes"`);
        await queryRunner.query(`ALTER TABLE "mfa_secrets" ADD "backupCodes" jsonb NOT NULL DEFAULT '[]'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mfa_secrets" DROP COLUMN "backupCodes"`);
        await queryRunner.query(`ALTER TABLE "mfa_secrets" ADD "backupCodes" text`);
    }

}
