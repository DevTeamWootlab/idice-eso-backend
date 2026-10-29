import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class CreateIncubationProfileDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Answers to the PRD Version 2 incubation questions (sections A–G), keyed as in prd-questions.ts INCUBATION_QUESTIONS. Validated server-side.',
    example: {
      ventureName: 'AgroLink',
      sector: 'Agriculture',
      stage: 'Prototype',
      ventureDescription: 'A marketplace linking smallholder farmers to buyers.',
      problem: 'Farmers lose produce because they cannot reach buyers.',
      solution: 'A USSD marketplace that matches farmers with buyers.',
      availability: 'Yes',
    },
  })
  @IsObject()
  details!: Record<string, unknown>;
}
