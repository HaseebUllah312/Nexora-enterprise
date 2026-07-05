import { IsUUID } from 'class-validator';
export class CreatePurchaseInvoiceDto {
  @IsUUID() purchaseOrderId: string;
}
