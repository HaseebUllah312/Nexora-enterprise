import { IsString, IsUUID, IsOptional, IsNumber, Min, IsDateString } from 'class-validator';

export class CreateEmployeeDto {
  @IsString() name: string;
  @IsOptional() @IsString() designation?: string;
  @IsUUID() branchId: string;
  @IsOptional() @IsNumber() @Min(0) salary?: number;
  @IsOptional() @IsDateString() joinDate?: string;
  @IsOptional() @IsUUID() userId?: string;
}
