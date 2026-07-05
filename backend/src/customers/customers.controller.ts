import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('customers')
@UseGuards(RolesGuard)
export class CustomersController {
  constructor(private service: CustomersService) {}

  @Post() @Roles('SUPER_ADMIN','OWNER','SALES_MANAGER','SALES_STAFF','BRANCH_MANAGER')
  create(@Body() dto: CreateCustomerDto) { return this.service.create(dto); }

  @Get() findAll(@Query('branchId') b?: string, @Query('search') s?: string) { return this.service.findAll(b, s); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Get(':id/ledger') ledger(@Param('id') id: string) { return this.service.ledger(id); }

  @Patch(':id') @Roles('SUPER_ADMIN','OWNER','SALES_MANAGER','BRANCH_MANAGER')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) { return this.service.update(id, dto); }

  @Delete(':id') @Roles('SUPER_ADMIN','OWNER')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
