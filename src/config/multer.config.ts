import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'image/jpeg',
  'image/png',
];

export const documentUploadOptions: MulterOptions = {
  storage: memoryStorage(), // buffer handed straight to StorageService, never touches local disk mid-request
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per PRD
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return callback(
        new BadRequestException(
          `File type ${file.mimetype} is not allowed. Accepted: PDF, DOCX, XLSX, CSV, JPEG, PNG.`,
        ),
        false,
      );
    }
    callback(null, true);
  },
};
