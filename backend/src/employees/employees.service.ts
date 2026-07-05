import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: { ...dto, joinDate: dto.joinDate ? new Date(dto.joinDate) : undefined },
    });
  }

  findAll(branchId?: string) {
    return this.prisma.employee.findMany({
      where: branchId ? { branchId } : undefined,
      include: { branch: true, user: { select: { email: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const e = await this.prisma.employee.findUnique({
      where: { id },
      include: { branch: true, attendance: { orderBy: { date: 'desc' }, take: 30 }, salarySlips: { orderBy: [{ year: 'desc' }, { month: 'desc' }] } },
    });
    if (!e) throw new NotFoundException('Employee not found');
    return e;
  }

  async markAttendance(dto: MarkAttendanceDto) {
    return this.prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: dto.employeeId, date: new Date(dto.date) } },
      update: {
        status: dto.status as any,
        checkIn: dto.checkIn ? new Date(dto.checkIn) : undefined,
        checkOut: dto.checkOut ? new Date(dto.checkOut) : undefined,
      },
      create: {
        employeeId: dto.employeeId, date: new Date(dto.date), status: dto.status as any,
        checkIn: dto.checkIn ? new Date(dto.checkIn) : undefined,
        checkOut: dto.checkOut ? new Date(dto.checkOut) : undefined,
      },
    });
  }

  async monthlySummary(employeeId: string, year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const records = await this.prisma.attendance.findMany({ where: { employeeId, date: { gte: start, lte: end } } });
    return {
      present: records.filter(r => r.status === 'PRESENT').length,
      absent:  records.filter(r => r.status === 'ABSENT').length,
      leave:   records.filter(r => r.status === 'LEAVE').length,
      halfDay: records.filter(r => r.status === 'HALF_DAY').length,
      total: records.length, records,
    };
  }

  // ── PAYROLL ──────────────────────────────────────────────────────────────
  async generateSalarySlip(employeeId: string, month: number, year: number, bonus = 0, deductions = 0) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const basicSalary = Number(employee.salary);
    const netSalary = basicSalary + bonus - deductions;
    const slipNo = `SLIP-${year}${String(month).padStart(2,'0')}-${employeeId.slice(0,6).toUpperCase()}`;

    return this.prisma.salarySlip.upsert({
      where: { employeeId_month_year: { employeeId, month, year } },
      update: { basicSalary, bonus, deductions, netSalary },
      create: { slipNo, employeeId, month, year, basicSalary, bonus, deductions, netSalary, status: 'PENDING' },
      include: { employee: { include: { branch: true } } },
    });
  }

  async markSlipPaid(slipId: string) {
    return this.prisma.salarySlip.update({
      where: { id: slipId },
      data: { status: 'PAID', paidOn: new Date() },
    });
  }

  async getSalarySlips(branchId?: string, month?: number, year?: number) {
    return this.prisma.salarySlip.findMany({
      where: {
        ...(month && year ? { month, year } : {}),
        employee: branchId ? { branchId } : undefined,
      },
      include: { employee: { include: { branch: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async bulkGeneratePayroll(branchId: string | undefined, month: number, year: number) {
    const employees = await this.prisma.employee.findMany({ where: branchId ? { branchId } : {} });
    const slips: any[] = [];
    for (const emp of employees) {
      const slip = await this.generateSalarySlip(emp.id, month, year);
      slips.push(slip);
    }
    return slips;
  }
}
