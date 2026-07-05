import { IsString, IsOptional, IsEmail } from 'class-validator';

export class CreateSupplierDto {
  @IsString() name: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() taxNumber?: string;
  @IsString() branchId: string;
}
