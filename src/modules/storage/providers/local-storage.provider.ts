import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { IStorageProvider } from '@/common/interfaces/storage-provider.interface';

@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private readonly uploadRootDir: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadRootDir = path.resolve(
      this.configService.get<string>('LOCAL_STORAGE_PATH', './uploads'),
    );
    if (!fs.existsSync(this.uploadRootDir)) {
      fs.mkdirSync(this.uploadRootDir, { recursive: true });
    }
  }

  private resolvePath(storageKey: string): string {
    const safeKey = path.normalize(storageKey).replace(/^(\.\.[\/\\])+/, '');
    return path.join(this.uploadRootDir, safeKey);
  }

  async uploadFile(
    buffer: Buffer,
    folderKey: string,
    fileName: string,
  ): Promise<string> {
    try {
      const sanitizedFileName = `${Date.now()}-${fileName.replace(/\s+/g, '_')}`;
      const relativeFolder = path.normalize(folderKey);
      const targetDir = path.join(this.uploadRootDir, relativeFolder);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const storageKey = path
        .join(relativeFolder, sanitizedFileName)
        .replace(/\\/g, '/');
      const absolutePath = this.resolvePath(storageKey);

      await fs.promises.writeFile(absolutePath, buffer);
      return storageKey;
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to save file locally: ${(error as Error).message}`,
      );
    }
  }

  async readFile(storageKey: string): Promise<Buffer> {
    try {
      const absolutePath = this.resolvePath(storageKey);
      if (!fs.existsSync(absolutePath)) {
        throw new NotFoundException(`File not found at key: ${storageKey}`);
      }
      return await fs.promises.readFile(absolutePath);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to read local file: ${(error as Error).message}`,
      );
    }
  }

  async deleteFile(storageKey: string): Promise<void> {
    try {
      const absolutePath = this.resolvePath(storageKey);
      if (fs.existsSync(absolutePath)) {
        await fs.promises.unlink(absolutePath);
      }
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to delete local file: ${(error as Error).message}`,
      );
    }
  }
}
