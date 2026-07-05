import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { StockInDto } from './dto/stock-in.dto';
import { StockOutDto } from './dto/stock-out.dto';
import { StockAdjustmentDto } from './dto/stock-adjustment.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('inventory')
@UseGuards(RolesGuard)
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get('stock')
  getStock(@Query('branchId') branchId?: string, @Query('warehouseId') warehouseId?: string) {
    return this.inventoryService.getStock(branchId, warehouseId);
  }

  @Get('movements')
  getMovements(@Query('productId') productId?: string) {
    return this.inventoryService.getMovements(productId);
  }

  @Post('stock-in')
  @Roles('SUPER_ADMIN', 'OWNER', 'WAREHOUSE_MANAGER', 'FACTORY_MANAGER')
  stockIn(@Body() dto: StockInDto) {
    return this.inventoryService.stockIn(dto);
  }

  @Post('stock-out')
  @Roles('SUPER_ADMIN', 'OWNER', 'WAREHOUSE_MANAGER', 'FACTORY_MANAGER')
  stockOut(@Body() dto: StockOutDto) {
    return this.inventoryService.stockOut(dto);
  }

  @Post('adjustment')
  @Roles('SUPER_ADMIN', 'OWNER', 'WAREHOUSE_MANAGER')
  adjustment(@Body() dto: StockAdjustmentDto) {
    return this.inventoryService.adjustment(dto);
  }

  // ---- Stock transfers ----

  @Post('transfers')
  @Roles('SUPER_ADMIN', 'OWNER', 'WAREHOUSE_MANAGER', 'BRANCH_MANAGER')
  createTransfer(@Body() dto: CreateTransferDto) {
    return this.inventoryService.createTransfer(dto);
  }

  @Get('transfers')
  listTransfers(@Query('branchId') branchId?: string) {
    return this.inventoryService.listTransfers(branchId);
  }

  @Patch('transfers/:id/approve')
  @Roles('SUPER_ADMIN', 'OWNER', 'BRANCH_MANAGER', 'FACTORY_MANAGER')
  approve(@Param('id') id: string) {
    return this.inventoryService.approveTransfer(id);
  }

  @Patch('transfers/:id/dispatch')
  @Roles('SUPER_ADMIN', 'OWNER', 'WAREHOUSE_MANAGER')
  dispatch(@Param('id') id: string) {
    return this.inventoryService.dispatchTransfer(id);
  }

  @Patch('transfers/:id/receive')
  @Roles('SUPER_ADMIN', 'OWNER', 'WAREHOUSE_MANAGER')
  receive(@Param('id') id: string) {
    return this.inventoryService.receiveTransfer(id);
  }

  @Patch('transfers/:id/reject')
  @Roles('SUPER_ADMIN', 'OWNER', 'BRANCH_MANAGER', 'FACTORY_MANAGER')
  reject(@Param('id') id: string) {
    return this.inventoryService.rejectTransfer(id);
  }
}
