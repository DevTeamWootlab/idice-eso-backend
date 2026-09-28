import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from '@/modules/storage/providers/s3-storage.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    StorageService,
    {
      provide: 'STORAGE_PROVIDER',
      useFactory: (configService: ConfigService) => {
        const driver = configService.get<string>('storage.provider', 'local');
        const logger = new Logger('StorageModule');
        if (driver === 's3') {
          logger.log(`Document storage: S3 bucket "${configService.get<string>('storage.bucket')}"`);
          return new S3StorageProvider(configService);
        }
        logger.warn(
          'Document storage: local disk. Files are lost on redeploy unless LOCAL_STORAGE_PATH is on a persistent volume.',
        );
        return new LocalStorageProvider(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
