import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1789750330874 implements MigrationInterface {
    name = 'InitialSchema1789750330874'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const addColumnIfMissing = async (
            tableName: string,
            columnName: string,
            definition: string,
        ): Promise<void> => {
            if (!(await queryRunner.hasColumn(tableName, columnName))) {
                await queryRunner.query(
                    `ALTER TABLE "${tableName}" ADD "${columnName}" ${definition}`,
                );
            }
        };

        const hasType = async (typeName: string): Promise<boolean> => {
            const result = await queryRunner.query(
                `SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = $1`,
                [typeName],
            );
            return result.length > 0;
        };

        await addColumnIfMissing(
            'score_cards',
            'credibilityGovernanceScore',
            'smallint NOT NULL DEFAULT 0',
        );
        await addColumnIfMissing('applications', 'finalScorePercent', 'numeric(5,2)');
        await addColumnIfMissing(
            'applications',
            'scoreVarianceFlagged',
            'boolean NOT NULL DEFAULT false',
        );
        await addColumnIfMissing(
            'applications',
            'scoreVarianceResolutionNote',
            'text',
        );
        await addColumnIfMissing(
            'applications',
            'scoreVarianceResolvedByUserId',
            'uuid',
        );
        await addColumnIfMissing(
            'applications',
            'scoreVarianceResolvedAt',
            'TIMESTAMP WITH TIME ZONE',
        );
        await addColumnIfMissing('applications', 'matchedAt', 'TIMESTAMP WITH TIME ZONE');
        await addColumnIfMissing('matches', 'breakdown', 'jsonb');
        await addColumnIfMissing('validation_records', 'checklist', 'jsonb');

        const hasCurrentEnum = await hasType('applications_statesofoperation_enum');
        const hasOldEnum = await hasType('applications_statesofoperation_enum_old');

        if (!hasCurrentEnum) {
            if (hasOldEnum) {
                await queryRunner.query(
                    `ALTER TYPE "public"."applications_statesofoperation_enum_old" RENAME TO "applications_statesofoperation_enum_legacy"`,
                );
            }

            await queryRunner.query(
                `CREATE TYPE "public"."applications_statesofoperation_enum" AS ENUM('BENUE', 'KOGI', 'KWARA', 'NASARAWA', 'NIGER', 'PLATEAU', 'FCT')`,
            );
        }

        if (await queryRunner.hasColumn('applications', 'statesOfOperation')) {
            const columnType = await queryRunner.query(
                `SELECT udt_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'applications' AND column_name = 'statesOfOperation'`,
            );
            if (
                columnType[0]?.udt_name !== '_applications_statesofoperation_enum'
            ) {
                await queryRunner.query(
                    `ALTER TABLE "applications" ALTER COLUMN "statesOfOperation" TYPE "public"."applications_statesofoperation_enum"[] USING "statesOfOperation"::text[]::"public"."applications_statesofoperation_enum"[]`,
                );
            }
        } else {
            await addColumnIfMissing(
                'applications',
                'statesOfOperation',
                '"public"."applications_statesofoperation_enum"[]',
            );
        }

        if (await hasType('applications_statesofoperation_enum_old')) {
            await queryRunner.query(
                `DROP TYPE "public"."applications_statesofoperation_enum_old"`,
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."applications_statesofoperation_enum_old" AS ENUM('BENUE', 'KOGI', 'KWARA', 'NASARAWA', 'NIGER', 'JOS', 'PLATEAU', 'FCT')`);
        await queryRunner.query(`ALTER TABLE "applications" ALTER COLUMN "statesOfOperation" TYPE "public"."applications_statesofoperation_enum_old"[] USING "statesOfOperation"::"text"::"public"."applications_statesofoperation_enum_old"[]`);
        await queryRunner.query(`DROP TYPE "public"."applications_statesofoperation_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."applications_statesofoperation_enum_old" RENAME TO "applications_statesofoperation_enum"`);
        await queryRunner.query(`ALTER TABLE "validation_records" DROP COLUMN "checklist"`);
        await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "breakdown"`);
        await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN "matchedAt"`);
        await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN "scoreVarianceResolvedAt"`);
        await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN "scoreVarianceResolvedByUserId"`);
        await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN "scoreVarianceResolutionNote"`);
        await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN "scoreVarianceFlagged"`);
        await queryRunner.query(`ALTER TABLE "applications" DROP COLUMN "finalScorePercent"`);
        await queryRunner.query(`ALTER TABLE "score_cards" DROP COLUMN "credibilityGovernanceScore"`);
    }

}
