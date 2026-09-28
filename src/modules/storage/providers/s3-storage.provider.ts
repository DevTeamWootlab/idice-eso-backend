import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { IStorageProvider } from '@/common/interfaces/storage-provider.interface';

@Injectable()
export class S3StorageProvider implements IStorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.getOrThrow<string>('storage.bucket');
    this.s3Client = new S3Client({
      region: this.configService.get<string>('storage.region', 'eu-west-1'),
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>(
          'storage.accessKeyId',
        ),
        secretAccessKey: this.configService.getOrThrow<string>(
          'storage.secretAccessKey',
        ),
      },
    });
  }


  async uploadFile(
    buffer: Buffer,
    folderKey: string,
    fileName: string,
  ): Promise<string> {
    const sanitizedFileName = `${Date.now()}-${fileName.replace(/\s+/g, '_')}`;
    const storageKey = `${folderKey}/${sanitizedFileName}`.replace(/\/+/g, '/');

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: storageKey,
          Body: buffer,
        }),
      );
      return storageKey;
    } catch (error) {
      throw new InternalServerErrorException(
        `S3 Upload failed: ${(error as Error).message}`,
      );
    }
  }

  async readFile(storageKey: string): Promise<Buffer> {
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: storageKey,
        }),
      );

      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } catch (error) {
      const name = (error as { name?: string; Code?: string })?.name ?? (error as { Code?: string })?.Code;
      const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
      if (name === 'NoSuchKey' || name === 'NotFound' || status === 404) {
        throw new NotFoundException(`File not found in storage: ${storageKey}`);
      }
      this.logger.error(`S3 read failed for ${storageKey}: ${(error as Error).message}`);
      throw new InternalServerErrorException('The file storage service could not be reached');
    }
  }

  async deleteFile(storageKey: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: storageKey,
        }),
      );
    } catch (error) {
      throw new InternalServerErrorException(
        `S3 Delete failed: ${(error as Error).message}`,
      );
    }
  }
}
