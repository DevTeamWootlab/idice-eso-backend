import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiCreatedResponse } from '@nestjs/swagger';

import { BeneficiariesService } from './beneficiaries.service';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { Public } from '@/common/decorators/public.decorator';
import { pitchDeckUploadOptions } from '@/config/multer.config';

@ApiTags('Public Beneficiary Intake')
@Controller('beneficiaries')
export class BeneficiariesController {
  constructor(private readonly beneficiariesService: BeneficiariesService) {}
  @ApiCreatedResponse({ description: 'POST pitch-deck.' })
  @Public()
  @Post('pitch-deck')
  @UseInterceptors(FileInterceptor('file', pitchDeckUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload acceleration pitch deck document (Max 10MB, PDF/DOCX/XLSX/CSV/JPEG/PNG)',
  })
  @ApiResponse({
    status: 201,
    description: 'Returns storage key for intake submission',
  })
  uploadPitchDeck(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.beneficiariesService.uploadPitchDeck(file);
  }

  @ApiCreatedResponse({ description: 'POST /.' })
  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit youth intake application (Public Endpoint)',
  })
  @ApiResponse({
    status: 201,
    description: 'Youth intake form successfully submitted.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Duplicate Email or NIN detected.',
  })
  @ApiResponse({
    status: 422,
    description:
      'Unprocessable Entity - Pillar profile mismatch or missing required conditional fields.',
  })
  registerIntake(@Body() dto: CreateBeneficiaryDto) {
    return this.beneficiariesService.registerIntake(dto);
  }
}
