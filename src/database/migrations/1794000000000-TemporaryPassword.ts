import { MigrationInterface, QueryRunner } from 'typeorm';

export class TemporaryPassword1794000000000 implements MigrationInterface {
  name = 'TemporaryPassword1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "temporaryPasswordHash" character varying`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "temporaryPasswordExpiresAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mustChangePassword" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "mustChangePassword"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "temporaryPasswordExpiresAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "temporaryPasswordHash"`);
  }
}
