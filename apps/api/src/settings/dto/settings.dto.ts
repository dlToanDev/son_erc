import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  warningDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  criticalWarningDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  timezone?: string;
}
