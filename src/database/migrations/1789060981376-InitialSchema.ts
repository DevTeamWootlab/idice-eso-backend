import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1789060981376 implements MigrationInterface {
    name = 'InitialSchema1789060981376'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" DROP CONSTRAINT "FK_1d0fd2b880523b477496d7750be"`);
        await queryRunner.query(`ALTER TABLE "beneficiary_incubation_profiles" DROP CONSTRAINT "FK_c9c01dddfbb658a95682c60dd95"`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" DROP CONSTRAINT "FK_bd336303341f771897518b89eb5"`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" DROP CONSTRAINT "FK_18ab4e023013dc48121406d7904"`);
        await queryRunner.query(`ALTER TABLE "beneficiary_acceleration_profiles" DROP CONSTRAINT "FK_a090488b402f3873db45300a8cc"`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ADD "ninHash" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ADD CONSTRAINT "UQ_f56c92b2118b762f7fb2fd4e6e5" UNIQUE ("ninHash")`);
        await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" DROP COLUMN "preferredHubType"`);
        await queryRunner.query(`CREATE TYPE "public"."beneficiary_skills_profiles_preferredhubtype_enum" AS ENUM('STANDARD', 'GAMING', 'VR', 'CREATIVE')`);
        await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" ADD "preferredHubType" "public"."beneficiary_skills_profiles_preferredhubtype_enum" NOT NULL`);
        await queryRunner.query(`ALTER TYPE "public"."beneficiary_skills_profiles_skilltier_enum" RENAME TO "beneficiary_skills_profiles_skilltier_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."beneficiary_skills_profiles_skilltier_enum" AS ENUM('FOUNDATIONAL', 'INTERMEDIATE', 'ADVANCED')`);
        
        await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" ALTER COLUMN "skillTier" TYPE "public"."beneficiary_skills_profiles_skilltier_enum" USING "skillTier"::"text"::"public"."beneficiary_skills_profiles_skilltier_enum"`);
        await queryRunner.query(`DROP TYPE "public"."beneficiary_skills_profiles_skilltier_enum_old"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b11f8a8fdc934fd5feea9e39f8"`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" DROP COLUMN "gender"`);
        await queryRunner.query(`CREATE TYPE "public"."beneficiaries_gender_enum" AS ENUM('MALE', 'FEMALE', 'PREFER_NOT_TO_SAY', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ADD "gender" "public"."beneficiaries_gender_enum" NOT NULL`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" DROP COLUMN "stateOfOrigin"`);
        await queryRunner.query(`CREATE TYPE "public"."beneficiaries_stateoforigin_enum" AS ENUM('ABIA', 'ADAMAWA', 'AKWA_IBOM', 'ANAMBRA', 'BAUCHI', 'BAYELSA', 'BENUE', 'BORNO', 'CROSS_RIVER', 'DELTA', 'EBONYI', 'EDO', 'EKITI', 'ENUGU', 'FCT', 'GOMBE', 'IMO', 'JIGAWA', 'KADUNA', 'KANO', 'KATSINA', 'KEBBI', 'KOGI', 'KWARA', 'LAGOS', 'NASARAWA', 'NIGER', 'OGUN', 'ONDO', 'OSUN', 'OYO', 'PLATEAU', 'RIVERS', 'SOKOTO', 'TARABA', 'YOBE', 'ZAMFARA')`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ADD "stateOfOrigin" "public"."beneficiaries_stateoforigin_enum" NOT NULL`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" DROP COLUMN "stateOfResidence"`);
        await queryRunner.query(`CREATE TYPE "public"."beneficiaries_stateofresidence_enum" AS ENUM('ABIA', 'ADAMAWA', 'AKWA_IBOM', 'ANAMBRA', 'BAUCHI', 'BAYELSA', 'BENUE', 'BORNO', 'CROSS_RIVER', 'DELTA', 'EBONYI', 'EDO', 'EKITI', 'ENUGU', 'FCT', 'GOMBE', 'IMO', 'JIGAWA', 'KADUNA', 'KANO', 'KATSINA', 'KEBBI', 'KOGI', 'KWARA', 'LAGOS', 'NASARAWA', 'NIGER', 'OGUN', 'ONDO', 'OSUN', 'OYO', 'PLATEAU', 'RIVERS', 'SOKOTO', 'TARABA', 'YOBE', 'ZAMFARA')`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ADD "stateOfResidence" "public"."beneficiaries_stateofresidence_enum" NOT NULL`);
        await queryRunner.query(`ALTER TYPE "public"."beneficiaries_pillar_enum" RENAME TO "beneficiaries_pillar_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."beneficiaries_pillar_enum" AS ENUM('SKILLS', 'INCUBATION', 'ACCELERATION')`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ALTER COLUMN "pillar" TYPE "public"."beneficiaries_pillar_enum" USING "pillar"::"text"::"public"."beneficiaries_pillar_enum"`);
        await queryRunner.query(`DROP TYPE "public"."beneficiaries_pillar_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."beneficiaries_status_enum" RENAME TO "beneficiaries_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."beneficiaries_status_enum" AS ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'ALLOCATED', 'REJECTED', 'WITHDRAWN')`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ALTER COLUMN "status" TYPE "public"."beneficiaries_status_enum" USING "status"::"text"::"public"."beneficiaries_status_enum"`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED'`);
        await queryRunner.query(`DROP TYPE "public"."beneficiaries_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "beneficiary_acceleration_profiles" ADD CONSTRAINT "UQ_559736e341890fdc04e888c45b5" UNIQUE ("cacRegistrationNumber")`);
        await queryRunner.query(`ALTER TABLE "courses" DROP CONSTRAINT "UQ_ee82d2848683925681f8c79a253"`);
        await queryRunner.query(`ALTER TYPE "public"."courses_tier_enum" RENAME TO "courses_tier_enum_old"`);
        // await queryRunner.query(`CREATE TYPE "public"."courses_tier_enum" AS ENUM('FOUNDATIONAL', 'INTERMEDIATE', 'ADVANCED')`);
         await queryRunner.query(`
            ALTER TABLE IF EXISTS "courses" ALTER COLUMN "tier" TYPE character varying USING "tier"::text;
        `);
                await queryRunner.query(`
            UPDATE "courses" SET "tier" = 'INTERMEDIATE' WHERE "tier" = 'DEVELOPMENTAL';
        `);
                await queryRunner.query(`
            UPDATE "courses" SET "tier" = 'ADVANCED' WHERE "tier" = 'SPECIALISED';
        `);
                await queryRunner.query(`
            DROP TYPE IF EXISTS "public"."courses_tier_enum" CASCADE;
        `);
                await queryRunner.query(`
            CREATE TYPE "public"."courses_tier_enum" AS ENUM('FOUNDATIONAL', 'INTERMEDIATE', 'ADVANCED');
        `);
            await queryRunner.query(`
            UPDATE "courses" 
            SET "tier" = 'FOUNDATIONAL' 
            WHERE "tier" IS NULL OR "tier" NOT IN ('FOUNDATIONAL', 'INTERMEDIATE', 'ADVANCED');
        `);
                await queryRunner.query(
                `ALTER TABLE "courses" ALTER COLUMN "tier" DROP DEFAULT;`,
                );
                await queryRunner.query(`
            ALTER TABLE "courses" 
            ALTER COLUMN "tier" TYPE "public"."courses_tier_enum" 
            USING "tier"::text::"public"."courses_tier_enum";
        `);

         await queryRunner.query(
           `ALTER TABLE "courses" ALTER COLUMN "tier" SET DEFAULT 'FOUNDATIONAL';`,
         );
        await queryRunner.query(`ALTER TABLE "courses" ALTER COLUMN "tier" TYPE "public"."courses_tier_enum" USING "tier"::"text"::"public"."courses_tier_enum"`);
        await queryRunner.query(`DROP TYPE "public"."courses_tier_enum_old"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1d0fd2b880523b477496d7750b" ON "beneficiary_skills_profiles"  ("beneficiaryId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c9c01dddfbb658a95682c60dd9" ON "beneficiary_incubation_profiles"  ("beneficiaryId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_16ae916776051c1fd593dcbb25" ON "beneficiaries"  ("referenceId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b70cc983d637bc33d21ee20778" ON "beneficiaries"  ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_b11f8a8fdc934fd5feea9e39f8" ON "beneficiaries"  ("assignedInstitutionId", "pillar") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a090488b402f3873db45300a8c" ON "beneficiary_acceleration_profiles"  ("beneficiaryId") `);
        await queryRunner.query(`ALTER TABLE "courses" ADD CONSTRAINT "UQ_ee82d2848683925681f8c79a253" UNIQUE ("title", "tier")`);
        await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" ADD CONSTRAINT "FK_1d0fd2b880523b477496d7750be" FOREIGN KEY ("beneficiaryId") REFERENCES "beneficiaries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "beneficiary_incubation_profiles" ADD CONSTRAINT "FK_c9c01dddfbb658a95682c60dd95" FOREIGN KEY ("beneficiaryId") REFERENCES "beneficiaries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ADD CONSTRAINT "FK_18ab4e023013dc48121406d7904" FOREIGN KEY ("preferredInstitutionId") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ADD CONSTRAINT "FK_bd336303341f771897518b89eb5" FOREIGN KEY ("assignedInstitutionId") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "beneficiary_acceleration_profiles" ADD CONSTRAINT "FK_a090488b402f3873db45300a8cc" FOREIGN KEY ("beneficiaryId") REFERENCES "beneficiaries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "beneficiary_acceleration_profiles" DROP CONSTRAINT "FK_a090488b402f3873db45300a8cc"`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" DROP CONSTRAINT "FK_bd336303341f771897518b89eb5"`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" DROP CONSTRAINT "FK_18ab4e023013dc48121406d7904"`);
        await queryRunner.query(`ALTER TABLE "beneficiary_incubation_profiles" DROP CONSTRAINT "FK_c9c01dddfbb658a95682c60dd95"`);
        await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" DROP CONSTRAINT "FK_1d0fd2b880523b477496d7750be"`);
        await queryRunner.query(`ALTER TABLE "courses" DROP CONSTRAINT "UQ_ee82d2848683925681f8c79a253"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a090488b402f3873db45300a8c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b11f8a8fdc934fd5feea9e39f8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b70cc983d637bc33d21ee20778"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_16ae916776051c1fd593dcbb25"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c9c01dddfbb658a95682c60dd9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1d0fd2b880523b477496d7750b"`);
        await queryRunner.query(`CREATE TYPE "public"."courses_tier_enum_old" AS ENUM('FOUNDATIONAL', 'DEVELOPMENTAL', 'SPECIALISED')`);
        await queryRunner.query(`ALTER TABLE "courses" ALTER COLUMN "tier" TYPE "public"."courses_tier_enum_old" USING "tier"::"text"::"public"."courses_tier_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."courses_tier_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."courses_tier_enum_old" RENAME TO "courses_tier_enum"`);
        await queryRunner.query(`ALTER TABLE "courses" ADD CONSTRAINT "UQ_ee82d2848683925681f8c79a253" UNIQUE ("title", "tier")`);
        await queryRunner.query(`ALTER TABLE "beneficiary_acceleration_profiles" DROP CONSTRAINT "UQ_559736e341890fdc04e888c45b5"`);
        await queryRunner.query(`CREATE TYPE "public"."beneficiaries_status_enum_old" AS ENUM('SUBMITTED', 'TAGGED', 'MATCHED')`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ALTER COLUMN "status" TYPE "public"."beneficiaries_status_enum_old" USING "status"::"text"::"public"."beneficiaries_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED'`);
        await queryRunner.query(`DROP TYPE "public"."beneficiaries_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."beneficiaries_status_enum_old" RENAME TO "beneficiaries_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."beneficiaries_pillar_enum_old" AS ENUM('TRAINING', 'INCUBATION', 'ACCELERATION')`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ALTER COLUMN "pillar" TYPE "public"."beneficiaries_pillar_enum_old" USING "pillar"::"text"::"public"."beneficiaries_pillar_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."beneficiaries_pillar_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."beneficiaries_pillar_enum_old" RENAME TO "beneficiaries_pillar_enum"`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" DROP COLUMN "stateOfResidence"`);
        await queryRunner.query(`DROP TYPE "public"."beneficiaries_stateofresidence_enum"`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ADD "stateOfResidence" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" DROP COLUMN "stateOfOrigin"`);
        await queryRunner.query(`DROP TYPE "public"."beneficiaries_stateoforigin_enum"`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ADD "stateOfOrigin" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" DROP COLUMN "gender"`);
        await queryRunner.query(`DROP TYPE "public"."beneficiaries_gender_enum"`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ADD "gender" character varying NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_b11f8a8fdc934fd5feea9e39f8" ON "beneficiaries" USING btree ("pillar", "assignedInstitutionId") `);
        await queryRunner.query(`CREATE TYPE "public"."beneficiary_skills_profiles_skilltier_enum_old" AS ENUM('FOUNDATIONAL', 'DEVELOPMENTAL', 'SPECIALISED')`);
        await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" ALTER COLUMN "skillTier" TYPE "public"."beneficiary_skills_profiles_skilltier_enum_old" USING "skillTier"::"text"::"public"."beneficiary_skills_profiles_skilltier_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."beneficiary_skills_profiles_skilltier_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."beneficiary_skills_profiles_skilltier_enum_old" RENAME TO "beneficiary_skills_profiles_skilltier_enum"`);
        await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" DROP COLUMN "preferredHubType"`);
        await queryRunner.query(`DROP TYPE "public"."beneficiary_skills_profiles_preferredhubtype_enum"`);
        await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" ADD "preferredHubType" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" DROP CONSTRAINT "UQ_f56c92b2118b762f7fb2fd4e6e5"`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" DROP COLUMN "ninHash"`);
        await queryRunner.query(`ALTER TABLE "beneficiary_acceleration_profiles" ADD CONSTRAINT "FK_a090488b402f3873db45300a8cc" FOREIGN KEY ("beneficiaryId") REFERENCES "beneficiaries"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ADD CONSTRAINT "FK_18ab4e023013dc48121406d7904" FOREIGN KEY ("preferredInstitutionId") REFERENCES "institutions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "beneficiaries" ADD CONSTRAINT "FK_bd336303341f771897518b89eb5" FOREIGN KEY ("assignedInstitutionId") REFERENCES "institutions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "beneficiary_incubation_profiles" ADD CONSTRAINT "FK_c9c01dddfbb658a95682c60dd95" FOREIGN KEY ("beneficiaryId") REFERENCES "beneficiaries"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "beneficiary_skills_profiles" ADD CONSTRAINT "FK_1d0fd2b880523b477496d7750be" FOREIGN KEY ("beneficiaryId") REFERENCES "beneficiaries"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
         await queryRunner.query(
           `ALTER TABLE "courses" ALTER COLUMN "tier" DROP DEFAULT;`,
         );
         await queryRunner.query(
           `ALTER TABLE "courses" ALTER COLUMN "tier" TYPE character varying USING "tier"::text;`,
         );
         await queryRunner.query(
           `DROP TYPE IF EXISTS "public"."courses_tier_enum" CASCADE;`,
         );
    }

}
