import { IsUUID, IsNumber, IsPositive, IsOptional, IsString } from 'class-validator';

export class StockOutDto {
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
