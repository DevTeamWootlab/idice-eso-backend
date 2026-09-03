import { AppDataSource } from '../data-source';
import { seedInstitutions } from './institutions.seed';
import { seedCourses } from './courses.seed';
import { seedRubric } from './rubric.seed';

async function seed(): Promise<void> {
  // 1. Initialize our centralized TypeORM DataSource connection pool
  await AppDataSource.initialize();

  try {
    // 2. Wrap execution blocks inside an atomic transaction scope
    await AppDataSource.transaction(async (transactionalEntityManager) => {
      // Pass the isolated 'transactionalEntityManager' down to maintain transaction context
      await seedInstitutions(transactionalEntityManager);
      await seedCourses(transactionalEntityManager);
      await seedRubric(transactionalEntityManager);
    });

    console.log(
      '✅ Database seed operations completed successfully: institutions, courses, and rubric.',
    );
  } catch (error) {
    console.error(
      '❌ Transaction failed. Rollback executed automatically.',
      error,
    );
    throw error;
  } finally {
    // 3. Guarantee cleanup by safely releasing connection pools back to Postgres
    await AppDataSource.destroy();
  }
}

seed().catch((error: unknown) => {
  console.error('💥 Database seed pipeline failed', error);
  process.exitCode = 1;
});
