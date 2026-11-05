import { MigrationInterface, QueryRunner } from 'typeorm';

export class RestoreNotificationIndex1793800000000 implements MigrationInterface {
  name = 'RestoreNotificationIndex1793800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_in_app_notifications_user_read" ON "in_app_notifications" ("userId", "readAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_in_app_notifications_user_read"`);
  }
}
