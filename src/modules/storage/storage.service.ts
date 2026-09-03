// modules/storage/storage.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class StorageService {
  async getUploadUrl(key: string, contentType: string): Promise<string> {
    return '';
  }
}
