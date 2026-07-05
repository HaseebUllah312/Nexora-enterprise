import { IsUUID, IsString, IsNumber, IsPositive, IsOptional } from 'class-validator';

export class CreateTransactionDto {
  @IsUUID() accountId: string;
  @IsString() type: string;  // DEBIT | CREDIT
  @IsNumber() @IsPositive() amount: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() referenceType?: string;
  @IsOptional() @IsString() referenceId?: string;
}
