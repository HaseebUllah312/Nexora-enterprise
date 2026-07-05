import { IsUUID, IsArray, ValidateNested, IsNumber, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

class PurchaseItemDto {
  @IsUUID() productId: string;
  @IsNumber() @IsPositive() quantity: number;
  @IsNumber() @IsPositive() unitCost: number;
}

export class CreatePurchaseOrderDto {
  @IsUUID() supplierId: string;
  @IsUUID() branchId: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];
}
