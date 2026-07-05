import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isMainBranch?: boolean;
}
