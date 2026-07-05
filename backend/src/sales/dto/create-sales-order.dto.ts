import { IsString, IsUUID, IsArray, ValidateNested, IsNumber, IsPositive, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

class SalesItemDto {
  @IsUUID() productId: string;
  @IsNumber() @IsPositive() quantity: number;
  @IsNumber() @IsPositive() unitPrice: number;
  @IsOptional() @IsNumber() @Min(0) discount?: number;
}

export class CreateSalesOrderDto {
  @IsUUID() customerId: string;
  @IsUUID() branchId: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => SalesItemDto)
  items: SalesItemDto[];
}
