import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1788492465798 implements MigrationInterface {
    name = 'InitialSchema1788492465798'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "email_verification_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', "userId" uuid NOT NULL, "token" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "used" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_3d1613f95c6a564a3b588d161ae" UNIQUE ("token"), CONSTRAINT "PK_417a095bbed21c2369a6a01ab9a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "login_attempts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', "email" character varying NOT NULL, "successful" boolean NOT NULL DEFAULT false, "ipAddress" character varying, CONSTRAINT "PK_070e613c8f768b1a70742705c5b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0aedff58b23995504f9dc99f75" ON "login_attempts"  ("email") `);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD "version" integer NOT NULL DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD "sessionId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD "userAgent" character varying`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD "ipAddress" character varying`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ALTER COLUMN "userId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN "expiresAt"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b25a58a00578bd1b7a01623d2d" ON "refresh_tokens"  ("sessionId") `);
        await queryRunner.query(`ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "FK_10f285d038feb767bf7c2da14b3" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`);
        await queryRunner.query(`ALTER TABLE "email_verification_tokens" DROP CONSTRAINT "FK_10f285d038feb767bf7c2da14b3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b25a58a00578bd1b7a01623d2d"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN "expiresAt"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD "expiresAt" TIMESTAMP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ALTER COLUMN "userId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN "ipAddress"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN "userAgent"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN "sessionId"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN "version"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN "created_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0aedff58b23995504f9dc99f75"`);
        await queryRunner.query(`DROP TABLE "login_attempts"`);
        await queryRunner.query(`DROP TABLE "email_verification_tokens"`);
    }

}
