import { IsUUID, IsNumber, IsPositive } from 'class-validator';
export class RecordSupplierPaymentDto {
  @IsUUID() invoiceId: string;
  @IsNumber() @IsPositive() amount: number;
}
