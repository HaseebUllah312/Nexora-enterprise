import { IsString, IsOptional, IsUUID, IsNumber, IsBoolean, Min } from 'class-validator';

export class CreateProductDto {
  @IsString()
  sku: string;

  @IsString()
  productCode: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  qrCode?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsString()
  unit: string;

  @IsNumber()
  @Min(0)
  purchasePrice: number;

  @IsNumber()
  @Min(0)
  salePrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  openingStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumStock?: number;

  @IsOptional()
  @IsBoolean()
  isRawMaterial?: boolean;
}
