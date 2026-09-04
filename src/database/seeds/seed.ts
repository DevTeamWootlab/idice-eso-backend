import { AppDataSource } from '../data-source';
import { seedInstitutions } from './institutions.seed';
import { seedCourses } from './courses.seed';
import { seedRubric } from './rubric.seed';
import { seedSystemAdmin } from './sysadmin.seed';
async function seed(): Promise<void> {
  await AppDataSource.initialize();
  try {
    // 2. Wrap execution blocks inside an atomic transaction scope
    await AppDataSource.transaction(async (transactionalEntityManager) => {
      // Pass the isolated 'transactionalEntityManager' down to maintain transaction context
      await seedInstitutions(transactionalEntityManager);
      await seedCourses(transactionalEntityManager);
      await seedRubric(transactionalEntityManager);
      await seedSystemAdmin(transactionalEntityManager);
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
    await AppDataSource.destroy();
  }
}

seed().catch((error: unknown) => {
  console.error('💥 Database seed pipeline failed', error);
  process.exitCode = 1;
});
