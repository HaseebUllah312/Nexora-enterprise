import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompanySettingsService {
  constructor(private prisma: PrismaService) {}

  async get(branchId: string) {
    let settings = await this.prisma.companySettings.findUnique({ where: { branchId } });
    if (!settings) {
      // Auto-create with defaults when first accessed
      const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
      settings = await this.prisma.companySettings.create({
        data: {
          branchId,
          companyName: branch?.name ?? 'My Company',
          city: branch?.city ?? '',
          phone: branch?.phone ?? '',
          address: branch?.address ?? '',
        },
      });
    }
    return settings;
  }

  async update(branchId: string, data: any) {
    return this.prisma.companySettings.upsert({
      where: { branchId },
      update: data,
      create: { branchId, ...data },
    });
  }

  /** Generate next sequential invoice number e.g. INV-2024-00042 */
  async nextInvoiceNumber(branchId: string): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      let settings = await tx.companySettings.findUnique({ where: { branchId } });
      if (!settings) {
        const branch = await tx.branch.findUnique({ where: { id: branchId } });
        settings = await tx.companySettings.create({
          data: { branchId, companyName: branch?.name ?? 'Company' },
        });
      }
      const year  = new Date().getFullYear();
      const num   = String(settings.invoiceCounter).padStart(5, '0');
      const prefix = settings.invoicePrefix || 'INV';
      const invoiceNo = `${prefix}-${year}-${num}`;
      await tx.companySettings.update({
        where: { branchId },
        data: { invoiceCounter: { increment: 1 } },
      });
      return invoiceNo;
    }, { timeout: 30000 });
  }

  async getDbPath(): Promise<string | null> {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl && dbUrl.startsWith('file:')) {
      return dbUrl.substring(5);
    }
    return null;
  }

  async disconnectDb() {
    await this.prisma.$disconnect();
  }

  async connectDb() {
    await this.prisma.$connect();
  }
}
