import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1788536266920 implements MigrationInterface {
    name = 'InitialSchema1788536266920'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mfa_secrets" DROP CONSTRAINT "FK_9adff2630422d0325ec3369f6e0"`);
        await queryRunner.query(`ALTER TABLE "mfa_secrets" ALTER COLUMN "userId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "mfa_secrets" ADD CONSTRAINT "FK_9adff2630422d0325ec3369f6e0" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mfa_secrets" DROP CONSTRAINT "FK_9adff2630422d0325ec3369f6e0"`);
        await queryRunner.query(`ALTER TABLE "mfa_secrets" ALTER COLUMN "userId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "mfa_secrets" ADD CONSTRAINT "FK_9adff2630422d0325ec3369f6e0" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
