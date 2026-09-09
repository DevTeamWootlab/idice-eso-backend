import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  DOCUMENT_TYPES,
  DocumentType,
} from '../entities/application-document.entity';

export class UploadDocumentDto {
  @ApiProperty({
    description:
      'The strict structural type classifier for the mandatory incoming file stream upload',
    enum: Object.values(DOCUMENT_TYPES),
    example: DOCUMENT_TYPES.REGISTRATION_CERTIFICATE,
    required: true,
  })
  @IsEnum(Object.values(DOCUMENT_TYPES), {
    message:
      'Invalid document type classification passed to upload controller stream',
  })
  @IsNotEmpty()
  documentType!: DocumentType;
}
