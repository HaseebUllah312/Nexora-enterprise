import { IsString, IsOptional, IsEmail, IsNumber, Min } from 'class-validator';

export class CreateCustomerDto {
  @IsString() name: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() taxNumber?: string;
  @IsOptional() @IsNumber() @Min(0) creditLimit?: number;
  @IsString() branchId: string;
}
