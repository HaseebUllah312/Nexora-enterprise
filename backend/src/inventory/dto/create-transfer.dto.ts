import { IsUUID, IsArray, ValidateNested, IsNumber, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

class TransferItemDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;
}

export class CreateTransferDto {
  @IsUUID()
  fromBranchId: string;

  @IsUUID()
  toBranchId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items: TransferItemDto[];
}
