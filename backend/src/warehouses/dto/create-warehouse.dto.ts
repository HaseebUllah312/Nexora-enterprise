import { IsString, IsUUID, IsOptional, IsBoolean } from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsUUID()
  branchId: string;

  @IsOptional()
  @IsBoolean()
  isGodown?: boolean;
}
