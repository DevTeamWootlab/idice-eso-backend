import { MigrationInterface, QueryRunner } from 'typeorm';

export class CohortPaused1789850000000 implements MigrationInterface {
  name = 'CohortPaused1789850000000';
  transaction = false as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE enum_name text;
      BEGIN
        SELECT t.typname INTO enum_name
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_type t ON t.oid = a.atttypid
        WHERE c.relname = 'cohorts' AND a.attname = 'status' AND t.typtype = 'e';
        IF enum_name IS NOT NULL THEN
          EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L AFTER %L', enum_name, 'PAUSED', 'ACTIVE');
        END IF;
      END $$;`);
  }

  public async down(): Promise<void> {
    return;
  }
}
