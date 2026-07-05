import { IsUUID, IsNumber, Min, IsOptional, IsString } from 'class-validator';

export class StockAdjustmentDto {
  @IsUUID()
  productId: string;

  @IsUUID()
  warehouseId: string;

  // The new, correct on-hand quantity (e.g. from a physical count) — not a delta
  @IsNumber()
  @Min(0)
  newQuantity: number;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsString()
  reason: string;
}
