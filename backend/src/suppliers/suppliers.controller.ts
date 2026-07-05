import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('suppliers')
@UseGuards(RolesGuard)
export class SuppliersController {
  constructor(private service: SuppliersService) {}

  @Post() @Roles('SUPER_ADMIN','OWNER','FACTORY_MANAGER','BRANCH_MANAGER')
  create(@Body() dto: CreateSupplierDto) { return this.service.create(dto); }

  @Get() findAll(@Query('branchId') b?: string, @Query('search') s?: string) { return this.service.findAll(b, s); }
  @Get('outstanding-balances') @Roles('SUPER_ADMIN','OWNER','ACCOUNTANT') outstandingBalances() { return this.service.outstandingBalances(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id') @Roles('SUPER_ADMIN','OWNER','FACTORY_MANAGER')
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) { return this.service.update(id, dto); }
}
