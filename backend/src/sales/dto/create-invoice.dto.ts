import { IsUUID, IsString, IsOptional, IsDateString, IsNumber, Min, Max } from 'class-validator';

export class CreateInvoiceDto {
  @IsUUID() salesOrderId: string;
  @IsString() paymentMethod: string;    // CASH | BANK | CREDIT
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) taxRate?: number;
}
