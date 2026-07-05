import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateSupplierDto) { return this.prisma.supplier.create({ data: dto }); }

  findAll(branchId?: string, search?: string) {
    return this.prisma.supplier.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(search ? { OR: [{ name: { contains: search } }, { phone: { contains: search } }] } : {}),
      },
      include: { branch: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const s = await this.prisma.supplier.findUnique({
      where: { id },
      include: { branch: true, purchaseOrders: { include: { invoice: true }, orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!s) throw new NotFoundException('Supplier not found');
    return s;
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.findOne(id);
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  // Outstanding balance: sum of (totalAmount - paidAmount) across all invoices
  async outstandingBalances() {
    const invoices = await this.prisma.purchaseInvoice.findMany({ include: { purchaseOrder: { include: { supplier: true } } } });
    const map = new Map<string, { supplier: any; outstanding: number }>();
    for (const inv of invoices) {
      const key = inv.purchaseOrder.supplierId;
      const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount);
      if (!map.has(key)) map.set(key, { supplier: inv.purchaseOrder.supplier, outstanding: 0 });
      map.get(key)!.outstanding += outstanding;
    }
    return [...map.values()].filter((v) => v.outstanding > 0);
  }
}
