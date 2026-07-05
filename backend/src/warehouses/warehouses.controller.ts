import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('warehouses')
@UseGuards(RolesGuard)
export class WarehousesController {
  constructor(private warehousesService: WarehousesService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'OWNER', 'FACTORY_MANAGER', 'BRANCH_MANAGER')
  create(@Body() dto: CreateWarehouseDto) {
    return this.warehousesService.create(dto);
  }

  @Get()
  findAll(@Query('branchId') branchId?: string) {
    return this.warehousesService.findAll(branchId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.warehousesService.findOne(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'OWNER', 'FACTORY_MANAGER', 'BRANCH_MANAGER')
  update(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehousesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'OWNER')
  remove(@Param('id') id: string) {
    return this.warehousesService.remove(id);
  }
}
