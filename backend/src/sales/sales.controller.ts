import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SalesService } from './sales.service';
import { DeliveryChallanService } from './delivery-challan.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('sales')
@UseGuards(RolesGuard)
export class SalesController {
  constructor(
    private service: SalesService,
    private challanService: DeliveryChallanService,
  ) {}

  @Post('orders') @Roles('SUPER_ADMIN','OWNER','SALES_MANAGER','SALES_STAFF','BRANCH_MANAGER')
  createOrder(@Body() dto: CreateSalesOrderDto, @CurrentUser() user: any) {
    return this.service.createOrder(dto, user.userId);
  }
  @Get('orders')
  findOrders(@Query('branchId') b?: string, @Query('customerId') c?: string, @Query('status') s?: string) {
    return this.service.findOrders(b, c, s);
  }
  @Get('orders/:id') findOneOrder(@Param('id') id: string) { return this.service.findOneOrder(id); }
  @Patch('orders/:id/confirm') @Roles('SUPER_ADMIN','OWNER','SALES_MANAGER','BRANCH_MANAGER')
  confirm(@Param('id') id: string) { return this.service.confirmOrder(id); }
  @Patch('orders/:id/cancel') @Roles('SUPER_ADMIN','OWNER','SALES_MANAGER','BRANCH_MANAGER')
  cancel(@Param('id') id: string) { return this.service.cancelOrder(id); }

  @Post('invoices') @Roles('SUPER_ADMIN','OWNER','SALES_MANAGER','ACCOUNTANT','BRANCH_MANAGER')
  createInvoice(@Body() dto: CreateInvoiceDto) { return this.service.createInvoice(dto); }
  @Post('invoices/payment') @Roles('SUPER_ADMIN','OWNER','ACCOUNTANT','SALES_MANAGER','BRANCH_MANAGER')
  recordPayment(@Body() dto: RecordPaymentDto) { return this.service.recordPayment(dto); }

  @Get('summary')
  summary(@Query('branchId') b?: string) { return this.service.salesSummary(b); }

  @Get('customer-statement/:customerId')
  customerStatement(@Param('customerId') id: string, @Query('from') f?: string, @Query('to') t?: string) {
    return this.service.customerStatement(id, f, t);
  }

  @Get('aging')
  aging(@Query('branchId') b?: string) { return this.service.agingReport(b); }

  @Post('challans') @Roles('SUPER_ADMIN','OWNER','SALES_MANAGER','BRANCH_MANAGER')
  createChallan(@Body() dto: any) { return this.challanService.create(dto); }
  @Get('challans')
  getChallans(@Query('branchId') b?: string) { return this.challanService.findAll(b); }
  @Get('challans/:id')
  getChallan(@Param('id') id: string) { return this.challanService.findOne(id); }
  @Patch('challans/:id/deliver') @Roles('SUPER_ADMIN','OWNER','SALES_MANAGER','BRANCH_MANAGER','DRIVER')
  markDelivered(@Param('id') id: string) { return this.challanService.markDelivered(id); }
}
