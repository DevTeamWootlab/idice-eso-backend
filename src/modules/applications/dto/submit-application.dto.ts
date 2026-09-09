import { IsInt, IsOptional, IsUUID } from 'class-validator';



export class SubmitApplicationDto {
  @IsUUID()
  applicationId!: string;

  @IsOptional()
  @IsInt()
  expectedVersion?: number;
}
