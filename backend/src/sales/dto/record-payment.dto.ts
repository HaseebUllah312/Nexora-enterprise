import { IsUUID, IsNumber, IsPositive } from 'class-validator';

export class RecordPaymentDto {
  @IsUUID() invoiceId: string;
  @IsNumber() @IsPositive() amount: number;
}
