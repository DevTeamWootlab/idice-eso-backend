import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/jpeg',
  'image/png',
];

function mimeTypeFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return callback(
      new BadRequestException(
        `File type ${file.mimetype} is not allowed. Accepted: PDF, DOCX, XLSX, CSV, JPEG, PNG.`,
      ),
      false,
    );
  }
  callback(null, true);
}

export const documentUploadOptions: MulterOptions = {
  storage: memoryStorage(), 
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per PRD
  fileFilter: mimeTypeFileFilter,
};

export const pitchDeckUploadOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: mimeTypeFileFilter,
};

export const EVIDENCE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
  'image/avif',
  'application/pdf',
  'application/octet-stream',
  '',
];

function evidenceFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!EVIDENCE_MIME_TYPES.includes((file.mimetype ?? '').toLowerCase())) {
    return callback(
      new BadRequestException(
        `File type ${file.mimetype} is not accepted as site-visit evidence. Upload a photo (JPEG, PNG, WebP, HEIC) or a PDF.`,
      ),
      false,
    );
  }
  callback(null, true);
}

export const evidenceUploadOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: evidenceFileFilter,
};
