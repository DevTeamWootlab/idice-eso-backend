import { MigrationInterface, QueryRunner } from 'typeorm';


export class InAppNotifications1789820000000 implements MigrationInterface {
  name = 'InAppNotifications1789820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // TypeORM's uuid primary keys default to uuid_generate_v4(); make sure the extension is there.
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'uuid-ossp not created here (it may already be provided): %', SQLERRM;
      END $$;`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "in_app_notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "version" integer NOT NULL DEFAULT 1,
        "userId" character varying NOT NULL,
        "title" character varying NOT NULL,
        "message" text NOT NULL,
        "href" character varying,
        "readAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_in_app_notifications_id" PRIMARY KEY ("id")
      )`);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_in_app_notifications_user_read" ON "in_app_notifications" ("userId", "readAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_in_app_notifications_user_read"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "in_app_notifications"`);
  }
}
