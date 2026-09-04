import * as argon2 from 'argon2';
import { AppDataSource } from '../data-source';
import { User } from '@/modules/users/entities/user.entity';
import { Role } from '@/common/enums/role.enum';
import { EntityManager } from 'typeorm';
export async function seedSystemAdmin(manager: EntityManager): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
 const repo = manager.getRepository(User);

  const email = process.env.SYSADMIN_SEED_EMAIL || 'admin@idice.eso.wootlab.ng';
  const existing = await repo.findOne({ where: { email } });

  if (existing) {
    console.log('Sysadmin already exists, skipping execution.');
    return;
  }

  const password = process.env.SYSADMIN_SEED_PASSWORD;
  if (!password) {
    throw new Error(
      ' Operational Failure: Set SYSADMIN_SEED_PASSWORD environment variable before running this seed.',
    );
  }

  const passwordHash = await argon2.hash(password);

  await repo.save(
    repo.create({
      email,
      passwordHash,
      fullName: 'System Administrator',
      role: Role.SYSADMIN,
      isEmailVerified: true,
      isActive: true,
    }),
  );

  console.log(
    `\n System Administrator account instantiated successfully: ${email}`,
  );
}

if (require.main === module) {
  AppDataSource.initialize()
    .then(async () => {
      return seedSystemAdmin(AppDataSource.manager);
    })
    .then(async () => {
      await AppDataSource.destroy();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Standalone Sysadmin instantiation failed', err);
      if (AppDataSource.isInitialized) {
        await AppDataSource.destroy();
      }
      process.exit(1);
    });
}
