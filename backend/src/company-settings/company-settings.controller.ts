import { Body, Controller, Get, Patch, Query, UseGuards, Res, Post, BadRequestException } from '@nestjs/common';
import { CompanySettingsService } from './company-settings.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Response } from 'express';
import * as fs from 'fs';

@Controller('company-settings')
@UseGuards(RolesGuard)
export class CompanySettingsController {
  constructor(private service: CompanySettingsService) {}

  @Get()
  get(@CurrentUser() user: any, @Query('branchId') branchId?: string) {
    const id = user.branchId ?? branchId;
    return id ? this.service.get(id) : { message: 'branchId required' };
  }

  @Patch()
  @Roles('SUPER_ADMIN', 'OWNER', 'BRANCH_MANAGER')
  update(@CurrentUser() user: any, @Body() body: any, @Query('branchId') branchId?: string) {
    const id = user.branchId ?? branchId ?? body.branchId;
    return this.service.update(id, body);
  }

  @Get('backup')
  @Roles('SUPER_ADMIN', 'OWNER')
  async downloadBackup(@Res() res: Response) {
    const dbPath = await this.service.getDbPath();
    if (dbPath && fs.existsSync(dbPath)) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename=factory_erp_backup.db');
      const stream = fs.createReadStream(dbPath);
      stream.pipe(res);
      return;
    }
    res.status(404).json({ message: 'Database file not found' });
  }

  @Post('restore')
  @Roles('SUPER_ADMIN', 'OWNER')
  async restoreBackup(@Body() body: { fileData: string }) {
    if (!body.fileData) {
      throw new BadRequestException('No file data provided');
    }
    const dbPath = await this.service.getDbPath();
    if (dbPath) {
      const buffer = Buffer.from(body.fileData, 'base64');
      const header = buffer.toString('utf8', 0, 15);
      if (header !== 'SQLite format 3') {
        throw new BadRequestException('Invalid database file format');
      }

      await this.service.disconnectDb();
      try {
        fs.writeFileSync(dbPath, buffer);
      } finally {
        await this.service.connectDb();
      }
      return { success: true, message: 'Database restored successfully' };
    }
    throw new BadRequestException('Database restore only supported in SQLite mode');
  }
}
