import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ManufacturingService } from './manufacturing.service';
import { CreateBomDto } from './dto/create-bom.dto';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('manufacturing')
@UseGuards(RolesGuard)
export class ManufacturingController {
  constructor(private service: ManufacturingService) {}

  // BOM
  @Post('bom') @Roles('SUPER_ADMIN','OWNER','PRODUCTION_MANAGER','FACTORY_MANAGER')
  createBom(@Body() dto: CreateBomDto) { return this.service.createBom(dto); }

  @Get('bom') findAllBoms() { return this.service.findAllBoms(); }
  @Get('bom/:id') findOneBom(@Param('id') id: string) { return this.service.findOneBom(id); }

  // Production orders
  @Post('orders') @Roles('SUPER_ADMIN','OWNER','PRODUCTION_MANAGER','FACTORY_MANAGER')
  createOrder(@Body() dto: CreateProductionOrderDto) { return this.service.createProductionOrder(dto); }

  @Get('orders')
  findAllOrders(@Query('branchId') b?: string, @Query('status') s?: string) { return this.service.findAllOrders(b, s); }

  @Get('orders/:id') findOneOrder(@Param('id') id: string) { return this.service.findOneOrder(id); }

  @Patch('orders/:id/start') @Roles('SUPER_ADMIN','OWNER','PRODUCTION_MANAGER','FACTORY_MANAGER')
  start(@Param('id') id: string) { return this.service.startProduction(id); }

  @Patch('orders/:id/complete') @Roles('SUPER_ADMIN','OWNER','PRODUCTION_MANAGER','FACTORY_MANAGER')
  complete(
    @Param('id') id: string,
    @Query('quantityProduced') qty: string,
    @Query('wastage') wastage?: string,
  ) { return this.service.completeProduction(id, Number(qty), wastage ? Number(wastage) : 0); }

  @Get('stats')
  stats(@Query('branchId') b?: string) { return this.service.productionStats(b); }
}
