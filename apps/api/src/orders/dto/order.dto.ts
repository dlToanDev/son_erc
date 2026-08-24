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

export class OrderItemDto {
  /** Bắt buộc chọn từ danh mục NCC — server snapshot tên/ĐVT/giá từ DB. */
  @IsString()
  @MinLength(1)
  productId!: string;

  @IsNumber()
  @Min(0.001, { message: 'Số lượng phải lớn hơn 0' })
  quantity!: number;
}

export class CreateOrderDto {
  @IsString()
  @MinLength(1)
  supplierId!: string;

  @IsString()
  @MinLength(1)
  facilityId!: string;

  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Đơn hàng phải có ít nhất 1 dòng' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

export class RejectOrderDto {
  @IsString()
  @MinLength(3, { message: 'Vui lòng nhập lý do từ chối' })
  @MaxLength(500)
  reason!: string;
}

export class ApproveOrderDto {
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateOrderDto {
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Đơn hàng phải có ít nhất 1 dòng' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

