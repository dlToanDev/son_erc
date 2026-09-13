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

  /**
   * Đơn giá do Admin sửa (khi NCC báo tăng giá). Chỉ Admin được truyền;
   * nếu có, ghi vào đơn + danh mục NCC. Bỏ trống ⇒ snapshot giá từ danh mục.
   */
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Đơn giá không hợp lệ' })
  unitPrice?: number;
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

/** Nhận hàng: sinh phiếu nhập + công nợ. Hạn thanh toán nhập ở bước này. */
export class ReceiveOrderDto {
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

/** Thanh toán trọn cả đơn: sinh 1 khoản chi = số nợ còn lại. */
export class PayOrderDto {
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  transactionCode?: string;

  @IsOptional()
  @IsString()
  proofUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
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

