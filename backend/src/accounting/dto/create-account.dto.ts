import { IsString, IsUUID } from 'class-validator';

export class CreateAccountDto {
  @IsString() name: string;
  @IsString() type: string;  // CASH | BANK | RECEIVABLE | PAYABLE | EXPENSE | INCOME | EQUITY
  @IsUUID() branchId: string;
}
