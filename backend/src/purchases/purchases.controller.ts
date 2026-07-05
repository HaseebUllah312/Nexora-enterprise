import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { GoodsReceivingDto } from './dto/goods-receiving.dto';
import { CreatePurchaseInvoiceDto } from './dto/create-purchase-invoice.dto';
import { RecordSupplierPaymentDto } from './dto/record-supplier-payment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('purchases')
@UseGuards(RolesGuard)
export class PurchasesController {
  constructor(private service: PurchasesService) {}

  @Post('orders') @Roles('SUPER_ADMIN','OWNER','FACTORY_MANAGER','BRANCH_MANAGER')
  create(@Body() dto: CreatePurchaseOrderDto, @CurrentUser() user: any) { return this.service.createOrder(dto, user.userId); }

  @Get('orders')
  findAll(@Query('branchId') b?: string, @Query('supplierId') s?: string, @Query('status') st?: string) {
    return this.service.findOrders(b, s, st);
  }

  @Get('orders/:id') findOne(@Param('id') id: string) { return this.service.findOneOrder(id); }

  @Patch('orders/:id/approve') @Roles('SUPER_ADMIN','OWNER','FACTORY_MANAGER')
  approve(@Param('id') id: string) { return this.service.approveOrder(id); }

  @Post('grn') @Roles('SUPER_ADMIN','OWNER','WAREHOUSE_MANAGER','FACTORY_MANAGER')
  goodsReceiving(@Body() dto: GoodsReceivingDto) { return this.service.goodsReceiving(dto); }

  @Post('invoices') @Roles('SUPER_ADMIN','OWNER','ACCOUNTANT','FACTORY_MANAGER')
  createInvoice(@Body() dto: CreatePurchaseInvoiceDto) { return this.service.createInvoice(dto); }

  @Post('invoices/payment') @Roles('SUPER_ADMIN','OWNER','ACCOUNTANT')
  recordPayment(@Body() dto: RecordSupplierPaymentDto) { return this.service.recordPayment(dto); }

  @Get('summary')
  summary(@Query('branchId') branchId?: string) { return this.service.purchaseSummary(branchId); }
}
