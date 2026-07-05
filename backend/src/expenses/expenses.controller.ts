import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('expenses')
@UseGuards(RolesGuard)
export class ExpensesController {
  constructor(private service: ExpensesService) {}

  @Post()
  @Roles('SUPER_ADMIN','OWNER','ACCOUNTANT','BRANCH_MANAGER','FACTORY_MANAGER')
  create(@Body() dto: any) { return this.service.create(dto); }

  @Get()
  findAll(
    @Query('branchId') b?: string, @Query('from') from?: string,
    @Query('to') to?: string,      @Query('category') cat?: string,
  ) { return this.service.findAll(b, from, to, cat); }

  @Get('summary')
  summary(@Query('branchId') b?: string) { return this.service.summary(b); }

  @Delete(':id')
  @Roles('SUPER_ADMIN','OWNER','ACCOUNTANT')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
