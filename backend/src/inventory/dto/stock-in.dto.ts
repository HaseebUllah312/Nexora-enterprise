import { IsUUID, IsNumber, IsPositive, IsOptional, IsString } from 'class-validator';

export class StockInDto {
  @IsUUID()
  productId: string;

  @IsUUID()
  warehouseId: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
