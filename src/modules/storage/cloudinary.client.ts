import { createHash, randomUUID } from 'node:crypto';
import { BadGatewayException, Logger, NotFoundException } from '@nestjs/common';

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder?: string;
}

export interface CloudinaryAssetRef {
  cloudName: string;
  resourceType: 'image' | 'raw' | 'video';
  deliveryType: string;
  publicId: string;
  format?: string;
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'avif', 'bmp', 'tif', 'tiff']);
const BROWSER_UNSAFE_IMAGE_FORMATS = new Set(['heic', 'heif', 'avif', 'tif', 'tiff', 'bmp']);

export interface CloudinaryUploadOptions {
  contentType?: string;
  browserSafe?: boolean;
}

export function withDeliveryFormat(url: string, format: string): string {
  const [path, query] = url.split('?');
  const slash = path.lastIndexOf('/');
  const dot = path.lastIndexOf('.');
  const next = dot > slash ? `${path.slice(0, dot)}.${format}` : `${path}.${format}`;
  return query ? `${next}?${query}` : next;
}

export function browserSafeCloudinaryUrl(url: string): string {
  const ref = parseCloudinaryUrl(url);
  if (!ref || ref.resourceType !== 'image' || !ref.format) return url;
  return BROWSER_UNSAFE_IMAGE_FORMATS.has(ref.format) ? withDeliveryFormat(url, 'jpg') : url;
}
const REQUEST_TIMEOUT_MS = 30_000;

export function isCloudinaryConfigured(config: Partial<CloudinaryConfig> | undefined): config is CloudinaryConfig {
  return !!config?.cloudName && !!config.apiKey && !!config.apiSecret;
}

export function parseCloudinaryUrl(url: string): CloudinaryAssetRef | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)res\.cloudinary\.com$/i.test(parsed.hostname)) return null;
  const segments = parsed.pathname.split('/').filter(Boolean).map((s) => decodeURIComponent(s));
  if (segments.length < 4) return null;
  const [cloudName, resourceType, deliveryType, ...rest] = segments;
  if (!['image', 'raw', 'video'].includes(resourceType)) return null;

  let startIndex = 0;
  const versionIndex = rest.findIndex((segment) => /^v\d+$/.test(segment));
  if (versionIndex >= 0) {
    startIndex = versionIndex + 1;
  } else {
    while (
      startIndex < rest.length - 1 &&
      /^[a-z]{1,4}_[^/]+(,[a-z]{1,4}_[^/]+)*$/.test(rest[startIndex])
    ) {
      startIndex += 1;
    }
  }
  const idPath = rest.slice(startIndex).join('/');
  if (!idPath) return null;

  if (resourceType === 'raw') {
    return { cloudName, resourceType, deliveryType, publicId: idPath };
  }
  const dot = idPath.lastIndexOf('.');
  const hasExt = dot > idPath.lastIndexOf('/') && dot > 0;
  return {
    cloudName,
    resourceType: resourceType as CloudinaryAssetRef['resourceType'],
    deliveryType,
    publicId: hasExt ? idPath.slice(0, dot) : idPath,
    format: hasExt ? idPath.slice(dot + 1).toLowerCase() : undefined,
  };
}

function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]{1,8})$/i.exec(fileName);
  return match ? match[1].toLowerCase() : '';
}

function safeBaseName(fileName: string): string {
  const withoutExt = fileName.replace(/\.[a-z0-9]{1,8}$/i, '');
  const cleaned = withoutExt
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60);
  return cleaned || 'file';
}

export class CloudinaryClient {
  private readonly logger = new Logger(CloudinaryClient.name);

  constructor(private readonly config: CloudinaryConfig) {}

  get cloudName(): string {
    return this.config.cloudName;
  }

  private sign(params: Record<string, string | number | undefined>): string {
    const payload = Object.keys(params)
      .filter((key) => params[key] !== undefined && params[key] !== '')
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    return createHash('sha1').update(payload + this.config.apiSecret).digest('hex');
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      this.logger.error(`Cloudinary request failed: ${(error as Error).message}`);
      throw new BadGatewayException('Cloudinary could not be reached');
    } finally {
      clearTimeout(timer);
    }
  }

  async upload(
    buffer: Buffer,
    folderKey: string,
    fileName: string,
    options: CloudinaryUploadOptions = {},
  ): Promise<string> {
    const ext = extensionOf(fileName);
    const resourceType = IMAGE_EXTENSIONS.has(ext) ? 'image' : 'raw';
    const folder = [this.config.folder, folderKey]
      .filter(Boolean)
      .join('/')
      .replace(/\/+/g, '/')
      .replace(/^\/|\/$/g, '');
    const base = `${randomUUID().slice(0, 8)}-${safeBaseName(fileName)}`;
    const publicId = `${folder}/${resourceType === 'raw' && ext ? `${base}.${ext}` : base}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.sign({ public_id: publicId, timestamp });

    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(buffer)], options.contentType ? { type: options.contentType } : undefined),
      fileName,
    );
    form.append('public_id', publicId);
    form.append('timestamp', String(timestamp));
    form.append('api_key', this.config.apiKey);
    form.append('signature', signature);

    const response = await this.request(
      `https://api.cloudinary.com/v1_1/${this.config.cloudName}/${resourceType}/upload`,
      { method: 'POST', body: form },
    );
    const body = (await response.json().catch(() => ({}))) as { secure_url?: string; error?: { message?: string } };
    if (!response.ok || !body.secure_url) {
      this.logger.error(`Cloudinary upload failed (${response.status}): ${body.error?.message ?? 'no details'}`);
      throw new BadGatewayException(`Cloudinary upload failed: ${body.error?.message ?? response.statusText}`);
    }
    return options.browserSafe && resourceType === 'image' ? browserSafeCloudinaryUrl(body.secure_url) : body.secure_url;
  }

  canSign(ref: CloudinaryAssetRef): boolean {
    return ref.cloudName === this.config.cloudName;
  }

  async download(ref: CloudinaryAssetRef): Promise<Buffer> {
    const timestamp = Math.floor(Date.now() / 1000);
    const params: Record<string, string | number | undefined> = {
      public_id: ref.publicId,
      format: ref.resourceType === 'raw' ? undefined : ref.format,
      type: ref.deliveryType,
      timestamp,
    };
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') query.set(key, String(value));
    }
    query.set('api_key', this.config.apiKey);
    query.set('signature', this.sign(params));

    const response = await this.request(
      `https://api.cloudinary.com/v1_1/${this.config.cloudName}/${ref.resourceType}/download?${query.toString()}`,
      { method: 'GET' },
    );
    if (response.status === 404) {
      throw new NotFoundException('The document no longer exists on Cloudinary');
    }
    if (!response.ok) {
      this.logger.error(`Cloudinary signed download failed (${response.status}) for ${ref.publicId}`);
      throw new BadGatewayException('Cloudinary could not deliver this document');
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async destroy(ref: CloudinaryAssetRef): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { public_id: ref.publicId, type: ref.deliveryType, timestamp };
    const form = new FormData();
    form.append('public_id', ref.publicId);
    form.append('type', ref.deliveryType);
    form.append('timestamp', String(timestamp));
    form.append('api_key', this.config.apiKey);
    form.append('signature', this.sign(params));
    const response = await this.request(
      `https://api.cloudinary.com/v1_1/${this.config.cloudName}/${ref.resourceType}/destroy`,
      { method: 'POST', body: form },
    );
    if (!response.ok) {
      this.logger.warn(`Cloudinary destroy failed (${response.status}) for ${ref.publicId}`);
    }
  }
}
