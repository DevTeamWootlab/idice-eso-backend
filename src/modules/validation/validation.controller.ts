// modules/validation/validation.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ValidationService } from './validation.service';
import { SubmitValidationDto } from './dto/submit-validation.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@Controller('internal/applications')
@Roles(Role.VALIDATOR)
export class ValidationController {
  constructor(private readonly validationService: ValidationService) {}

  @Get('queue/validation')
  getQueue(@CurrentUser() user: JwtPayload) {
    return this.validationService.getQueue(user.sub);
  }

  @Get(':id/validation')
  getDossier(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.validationService.getDossier(id, user.sub);
  }

  @Post(':id/validation/submit')
  submitValidation(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitValidationDto,
  ) {
    return this.validationService.submitValidation(id, user.sub, dto);
  }
}
