import { IsUUID, IsNumber, IsPositive } from 'class-validator';

export class CreateProductionOrderDto {
  @IsUUID() bomId: string;
  @IsUUID() branchId: string;
  @IsNumber() @IsPositive() quantityPlanned: number;
}
