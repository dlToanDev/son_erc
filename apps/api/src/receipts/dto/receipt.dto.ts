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

export class ReceiptItemDto {
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

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class CreateReceiptDto {
  @IsString()
  @MinLength(1)
  supplierId!: string;

  @IsString()
  @MinLength(1)
  facilityId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  supplierInvoiceCode?: string;

  @IsDateString()
  receiptDate!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Phiếu nhập phải có ít nhất 1 dòng' })
  @ValidateNested({ each: true })
  @Type(() => ReceiptItemDto)
  items!: ReceiptItemDto[];
}
