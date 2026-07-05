import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('returns')
@UseGuards(RolesGuard)
export class ReturnsController {
  constructor(private service: ReturnsService) {}

  @Post('sale')
  @Roles('SUPER_ADMIN','OWNER','SALES_MANAGER','BRANCH_MANAGER','ACCOUNTANT')
  createSaleReturn(@Body() dto: any) { return this.service.createSaleReturn(dto); }

  @Get('sale')
  getSaleReturns(@Query('branchId') b?: string) { return this.service.getSaleReturns(b); }

  @Post('purchase')
  @Roles('SUPER_ADMIN','OWNER','FACTORY_MANAGER','BRANCH_MANAGER','ACCOUNTANT')
  createPurchaseReturn(@Body() dto: any) { return this.service.createPurchaseReturn(dto); }

  @Get('purchase')
  getPurchaseReturns(@Query('branchId') b?: string) { return this.service.getPurchaseReturns(b); }
}
