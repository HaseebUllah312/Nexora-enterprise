import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('dashboard')
@UseGuards(RolesGuard)
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get('summary') @Roles('SUPER_ADMIN','OWNER','FACTORY_MANAGER')
  summary() { return this.service.ownerSummary(); }

  @Get('sales-trend')
  salesTrend(@Query('branchId') b?: string) { return this.service.salesTrend(b); }
}
