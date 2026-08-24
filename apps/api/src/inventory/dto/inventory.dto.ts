import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class IssueItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  itemName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  unit!: string;

  @IsNumber()
  @Min(0.001, { message: 'Số lượng phải lớn hơn 0' })
  quantity!: number;
}

export class CreateIssueDto {
  @IsString()
  @MinLength(1)
  facilityId!: string;

  @IsDateString()
  issueDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Phiếu xuất phải có ít nhất 1 dòng' })
  @ValidateNested({ each: true })
  @Type(() => IssueItemDto)
  items!: IssueItemDto[];
}

/** Kiểm tra tồn trước khi xuất — cùng shape với CreateIssueDto (bỏ note). */
export class CheckIssueDto {
  @IsString()
  @MinLength(1)
  facilityId!: string;

  @IsDateString()
  issueDate!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => IssueItemDto)
  items!: IssueItemDto[];
}

export class UpdateIssueDto {
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Phiếu xuất phải có ít nhất 1 dòng' })
  @ValidateNested({ each: true })
  @Type(() => IssueItemDto)
  items?: IssueItemDto[];
}
