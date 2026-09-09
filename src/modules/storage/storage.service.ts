// // modules/storage/storage.service.ts
// import { Injectable } from '@nestjs/common';

// @Injectable()
// export class StorageService {
//   async getUploadUrl(key: string, contentType: string): Promise<string> {
//     return '';
//   }
// }

import { Inject, Injectable } from '@nestjs/common';
import { IStorageProvider } from '@/common/interfaces/storage-provider.interface';

@Injectable()
export class StorageService {
  constructor(
    @Inject('STORAGE_PROVIDER')
    private readonly provider: IStorageProvider,
  ) {}

  uploadFile(
    buffer: Buffer,
    folderKey: string,
    fileName: string,
  ): Promise<string> {
    return this.provider.uploadFile(buffer, folderKey, fileName);
  }

  readFile(storageKey: string): Promise<Buffer> {
    return this.provider.readFile(storageKey);
  }

  deleteFile(storageKey: string): Promise<void> {
    return this.provider.deleteFile(storageKey);
  }
}
