import { IsUUID } from 'class-validator';
export class GoodsReceivingDto {
  @IsUUID() purchaseOrderId: string;
  @IsUUID() warehouseId: string;
}
