import { Controller, Post, Body } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';

@Controller('beneficiaries')
export class BeneficiariesController {
  @Public()
  @Post()
  submit(
    @Body()
    dto: any /* replace with actual CreateBeneficiaryDto once written */,
  ) {
    // no auth, no account creation
  }
}
