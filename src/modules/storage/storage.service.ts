import {
  BadGatewayException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { IStorageProvider } from '@/common/interfaces/storage-provider.interface';

const EXTERNAL_HOST_PATTERNS = [/^res\.cloudinary\.com$/i, /\.supabase\.co$/i];
const EXTERNAL_FETCH_TIMEOUT_MS = 20_000;

export function isExternalStorageKey(storageKey: string | null | undefined): boolean {
  return !!storageKey && /^https?:\/\//i.test(storageKey.trim());
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

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
    if (isExternalStorageKey(storageKey)) {
      return this.readExternalFile(storageKey.trim());
    }
    return this.provider.readFile(storageKey);
  }

  async deleteFile(storageKey: string): Promise<void> {
    if (isExternalStorageKey(storageKey)) {
      this.logger.warn(
        `Skipped deleting an externally hosted document (${new URL(storageKey.trim()).host}); remove it from that host if needed.`,
      );
      return;
    }
    return this.provider.deleteFile(storageKey);
  }

  private async readExternalFile(url: string): Promise<Buffer> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new NotFoundException('The stored document address is not valid');
    }
    if (parsed.protocol !== 'https:' || !EXTERNAL_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname))) {
      throw new ForbiddenException('Documents can only be read from the approved file hosts');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), EXTERNAL_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(parsed.toString(), { signal: controller.signal, redirect: 'follow' });
      if (response.status === 404) {
        throw new NotFoundException('The document no longer exists on the file host');
      }
      if (response.status === 401 || response.status === 403) {
        this.logger.error(`File host refused ${parsed.host}${parsed.pathname} with ${response.status}`);
        throw new BadGatewayException(
          parsed.hostname.endsWith('cloudinary.com')
            ? 'Cloudinary refused to deliver this file. Enable "Allow delivery of PDF and ZIP files" in the Cloudinary security settings.'
            : 'The file host refused to deliver this document',
        );
      }
      if (!response.ok) {
        this.logger.error(`File host returned ${response.status} for ${parsed.host}${parsed.pathname}`);
        throw new BadGatewayException('The file host could not deliver this document');
      }
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadGatewayException) throw error;
      this.logger.error(`Could not fetch ${parsed.host}${parsed.pathname}: ${(error as Error).message}`);
      throw new BadGatewayException('The file host could not be reached');
    } finally {
      clearTimeout(timer);
    }
  }
}
