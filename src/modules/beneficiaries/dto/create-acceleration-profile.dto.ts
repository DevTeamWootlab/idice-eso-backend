import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class CreateAccelerationProfileDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Answers to the PRD C2 acceleration questions (sections A, B, C, D and G), keyed as in prd-questions.ts ACCELERATION_QUESTIONS. The pitch deck is required. Validated server-side.',
    example: {
      companyName: 'PayNexus Ltd',
      cacRegistered: 'Yes',
      cacNumber: 'RC1234567',
      stage: 'Early revenue',
      pitchDeck: { url: 'https://res.cloudinary.com/demo/raw/upload/v1/beneficiary-documents/deck.pdf', name: 'deck.pdf' },
      accurateAndComplete: true,
    },
  })
  @IsObject()
  details!: Record<string, unknown>;
}
