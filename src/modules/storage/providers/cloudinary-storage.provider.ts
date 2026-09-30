import { Injectable, NotFoundException } from '@nestjs/common';
import { IStorageProvider } from '@/common/interfaces/storage-provider.interface';
import { CloudinaryClient, parseCloudinaryUrl } from '../cloudinary.client';

@Injectable()
export class CloudinaryStorageProvider implements IStorageProvider {
  constructor(private readonly client: CloudinaryClient) {}

  uploadFile(buffer: Buffer, folderKey: string, fileName: string): Promise<string> {
    return this.client.upload(buffer, folderKey, fileName);
  }

  async readFile(storageKey: string): Promise<Buffer> {
    const ref = parseCloudinaryUrl(storageKey);
    if (!ref) throw new NotFoundException('The stored document address is not a Cloudinary file');
    return this.client.download(ref);
  }

  async deleteFile(storageKey: string): Promise<void> {
    const ref = parseCloudinaryUrl(storageKey);
    if (!ref || !this.client.canSign(ref)) return;
    await this.client.destroy(ref);
  }
}
