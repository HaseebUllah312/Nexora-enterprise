import { IsString, IsUUID, IsOptional } from 'class-validator';

export class CreateVehicleDto {
  @IsString() plateNumber: string;
  @IsOptional() @IsString() model?: string;
  @IsUUID() branchId: string;
  @IsOptional() @IsString() driverName?: string;
}
