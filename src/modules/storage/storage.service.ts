import {
  BadGatewayException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { IStorageProvider } from '@/common/interfaces/storage-provider.interface';
import { CloudinaryClient, parseCloudinaryUrl } from './cloudinary.client';
import { sniffFileType, withExtension } from '@/common/utils/file-sniff';

export interface StoredEvidence {
  storageKey: string;
  fileName: string;
  contentType: string;
  provider: 'cloudinary' | 'default';
}

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
    @Optional()
    @Inject('CLOUDINARY_CLIENT')
    private readonly cloudinary: CloudinaryClient | null = null,
  ) {}

  uploadFile(
    buffer: Buffer,
    folderKey: string,
    fileName: string,
  ): Promise<string> {
    return this.provider.uploadFile(buffer, folderKey, fileName);
  }

  async uploadEvidence(
    buffer: Buffer,
    folderKey: string,
    originalName: string,
    declaredType?: string,
  ): Promise<StoredEvidence> {
    const sniffed = sniffFileType(buffer);
    const fileName = sniffed ? withExtension(originalName, sniffed.ext) : withExtension(originalName, 'bin');
    const contentType = sniffed?.mime ?? declaredType ?? 'application/octet-stream';
    if (this.cloudinary) {
      const storageKey = await this.cloudinary.upload(buffer, folderKey, fileName, {
        contentType,
        browserSafe: true,
      });
      const convertedToJpeg = sniffed?.ext !== 'jpg' && /\.jpg$/i.test(storageKey.split('?')[0]);
      return {
        storageKey,
        fileName: convertedToJpeg ? withExtension(fileName, 'jpg') : fileName,
        contentType: convertedToJpeg ? 'image/jpeg' : contentType,
        provider: 'cloudinary',
      };
    }
    this.logger.warn(
      'Validation evidence is going to the default storage provider because Cloudinary is not configured (set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET).',
    );
    const storageKey = await this.provider.uploadFile(buffer, folderKey, fileName);
    return { storageKey, fileName, contentType, provider: 'default' };
  }

  readFile(storageKey: string): Promise<Buffer> {
    if (isExternalStorageKey(storageKey)) {
      return this.readExternalFile(storageKey.trim());
    }
    return this.provider.readFile(storageKey);
  }

  async deleteFile(storageKey: string): Promise<void> {
    if (isExternalStorageKey(storageKey)) {
      const ref = parseCloudinaryUrl(storageKey.trim());
      if (ref && this.cloudinary?.canSign(ref)) {
        await this.cloudinary.destroy(ref);
        return;
      }
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

    const cloudinaryRef = parseCloudinaryUrl(parsed.toString());
    if (cloudinaryRef && this.cloudinary?.canSign(cloudinaryRef)) {
      try {
        return await this.cloudinary.download(cloudinaryRef);
      } catch (error) {
        if (error instanceof NotFoundException) throw error;
        this.logger.warn(`Signed Cloudinary download failed, trying the public address: ${(error as Error).message}`);
      }
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
            ? this.cloudinary
              ? 'Cloudinary refused to deliver this file. It belongs to a different Cloudinary account from the one configured on the server, and that account blocks PDF delivery.'
              : 'Cloudinary refused to deliver this file. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET on the server so documents are fetched through the signed API.'
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
