import { Module } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { DeliveryChallanService } from './delivery-challan.service';

@Module({
  providers: [SalesService, DeliveryChallanService],
  controllers: [SalesController],
  exports: [SalesService, DeliveryChallanService],
})
export class SalesModule {}
