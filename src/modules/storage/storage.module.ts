import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from '@/modules/storage/providers/s3-storage.provider';
import { CloudinaryStorageProvider } from './providers/cloudinary-storage.provider';
import { CloudinaryClient, isCloudinaryConfigured, type CloudinaryConfig } from './cloudinary.client';

@Module({
  imports: [ConfigModule],
  providers: [
    StorageService,
    {
      provide: 'CLOUDINARY_CLIENT',
      useFactory: (configService: ConfigService) => {
        const config = configService.get<Partial<CloudinaryConfig>>('storage.cloudinary');
        return isCloudinaryConfigured(config) ? new CloudinaryClient(config) : null;
      },
      inject: [ConfigService],
    },
    {
      provide: 'STORAGE_PROVIDER',
      useFactory: (configService: ConfigService, cloudinary: CloudinaryClient | null) => {
        const driver = configService.get<string>('storage.provider', 'local');
        const logger = new Logger('StorageModule');
        if (driver === 'cloudinary') {
          if (!cloudinary) {
            throw new Error('STORAGE_PROVIDER=cloudinary but CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY or CLOUDINARY_API_SECRET is missing');
          }
          logger.log(`Document storage: Cloudinary cloud "${cloudinary.cloudName}"`);
          return new CloudinaryStorageProvider(cloudinary);
        }
        if (driver === 's3') {
          logger.log(`Document storage: S3 bucket "${configService.get<string>('storage.bucket')}"`);
          return new S3StorageProvider(configService);
        }
        logger.warn(
          'Document storage: local disk. Files are lost on redeploy unless LOCAL_STORAGE_PATH is on a persistent volume.',
        );
        return new LocalStorageProvider(configService);
      },
      inject: [ConfigService, 'CLOUDINARY_CLIENT'],
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
