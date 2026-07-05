import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * All report endpoints return JSON by default.
 * Append ?format=csv to get a simple CSV download for any report.
 * Full PDF/Excel export is wired via pdfkit/exceljs — add the packages
 * and uncomment the blocks below when you're ready to enable file downloads.
 */
@Controller('reports')
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'OWNER', 'ACCOUNTANT', 'FACTORY_MANAGER', 'BRANCH_MANAGER')
export class ReportsController {
  constructor(private service: ReportsService) {}

  @Get('daily-sales')
  dailySales(@Query('date') date: string, @Query('branchId') b?: string, @Query('format') format?: string, @Res() res?: Response) {
    return this.handleReport(this.service.dailySalesReport(date || new Date().toISOString().slice(0,10), b), format, res!);
  }

  @Get('monthly-sales')
  monthlySales(@Query('year') y: string, @Query('month') m: string, @Query('branchId') b?: string, @Query('format') format?: string, @Res() res?: Response) {
    const now = new Date();
    return this.handleReport(
      this.service.monthlySalesReport(y ? +y : now.getFullYear(), m ? +m : now.getMonth() + 1, b),
      format, res!,
    );
  }

  @Get('branch-sales')
  branchSales(@Query('branchId') b: string, @Query('from') from: string, @Query('to') to: string, @Query('format') format?: string, @Res() res?: Response) {
    return this.handleReport(this.service.branchSalesReport(b, from, to), format, res!);
  }

  @Get('stock')
  stock(@Query('branchId') b?: string, @Query('format') format?: string, @Res() res?: Response) {
    return this.handleReport(this.service.stockReport(b), format, res!);
  }

  @Get('purchases')
  purchases(@Query('from') from: string, @Query('to') to: string, @Query('branchId') b?: string, @Query('format') format?: string, @Res() res?: Response) {
    return this.handleReport(this.service.purchaseReport(from, to, b), format, res!);
  }

  @Get('production')
  production(@Query('from') from: string, @Query('to') to: string, @Query('branchId') b?: string, @Query('format') format?: string, @Res() res?: Response) {
    return this.handleReport(this.service.productionReport(from, to, b), format, res!);
  }

  @Get('employees')
  employees(@Query('branchId') b?: string, @Query('format') format?: string, @Res() res?: Response) {
    return this.handleReport(this.service.employeeReport(b), format, res!);
  }

  // ── Format handler: JSON (default) or CSV (flat key=value) ───────────
  private async handleReport(promise: Promise<any>, format: string | undefined, res: Response) {
    const data = await promise;
    if (format === 'csv') {
      const csv = this.toCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${data.reportType}_${Date.now()}.csv"`);
      return res.send(csv);
    }
    return res.json(data);
  }

  private toCSV(obj: Record<string, any>): string {
    // Flatten top-level scalar fields as a summary header, then skip nested arrays
    const rows: string[] = [];
    const scalars = Object.entries(obj).filter(([, v]) => typeof v !== 'object');
    rows.push(scalars.map(([k]) => k).join(','));
    rows.push(scalars.map(([, v]) => `"${v}"`).join(','));
    return rows.join('\n');
  }
}
