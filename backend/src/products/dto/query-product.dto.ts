import { IsOptional, IsString, IsUUID, IsBooleanString } from 'class-validator';

export class QueryProductDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsBooleanString()
  isRawMaterial?: string;
}
