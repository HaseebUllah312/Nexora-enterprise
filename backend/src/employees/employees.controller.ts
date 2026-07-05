import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('employees')
@UseGuards(RolesGuard)
export class EmployeesController {
  constructor(private service: EmployeesService) {}

  @Post() @Roles('SUPER_ADMIN','OWNER','FACTORY_MANAGER','BRANCH_MANAGER')
  create(@Body() dto: CreateEmployeeDto) { return this.service.create(dto); }

  @Get() findAll(@Query('branchId') b?: string) { return this.service.findAll(b); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post('attendance') @Roles('SUPER_ADMIN','OWNER','FACTORY_MANAGER','BRANCH_MANAGER')
  markAttendance(@Body() dto: MarkAttendanceDto) { return this.service.markAttendance(dto); }

  @Get(':id/attendance-summary')
  monthlySummary(@Param('id') id: string, @Query('year') y: string, @Query('month') m: string) {
    return this.service.monthlySummary(id, Number(y), Number(m));
  }

  // ── Payroll ──
  @Post(':id/salary-slip') @Roles('SUPER_ADMIN','OWNER','ACCOUNTANT')
  genSlip(@Param('id') id: string, @Body() body: { month:number; year:number; bonus?:number; deductions?:number }) {
    return this.service.generateSalarySlip(id, body.month, body.year, body.bonus, body.deductions);
  }

  @Patch('salary-slip/:slipId/paid') @Roles('SUPER_ADMIN','OWNER','ACCOUNTANT')
  markPaid(@Param('slipId') slipId: string) { return this.service.markSlipPaid(slipId); }

  @Get('payroll/slips')
  getSlips(@Query('branchId') b?: string, @Query('month') m?: string, @Query('year') y?: string) {
    return this.service.getSalarySlips(b, m?Number(m):undefined, y?Number(y):undefined);
  }

  @Post('payroll/bulk-generate') @Roles('SUPER_ADMIN','OWNER','ACCOUNTANT')
  bulkGenerate(@Body() body: { branchId?:string; month:number; year:number }) {
    return this.service.bulkGeneratePayroll(body.branchId, body.month, body.year);
  }
}
