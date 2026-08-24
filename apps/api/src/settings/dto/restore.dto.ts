import { IsString } from 'class-validator';

export class RestoreLatestDto {
  /** Chuỗi xác nhận người dùng phải gõ ("KHOI PHUC"). */
  @IsString()
  confirm!: string;
}
