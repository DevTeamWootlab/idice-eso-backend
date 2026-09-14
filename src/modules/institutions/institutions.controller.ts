import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { InstitutionsService } from './institutions.service';
import { InstitutionResponseDto } from './dto/response.dto';

@ApiTags('Public Institutions')
@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Public()
  @Get('public')
  @ApiOperation({
    summary: 'Get active institutions list for form dropdowns',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns array of active institutions for UI selection.',
    type: [InstitutionResponseDto],
  })
  async getPublicInstitutions() {
    return this.institutionsService.findPublicActiveOptions();
  }
}
