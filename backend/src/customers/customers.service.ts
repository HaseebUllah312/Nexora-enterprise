import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: dto });
  }

  findAll(branchId?: string, search?: string) {
    return this.prisma.customer.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(search ? {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
          ],
        } : {}),
      },
      include: { branch: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const c = await this.prisma.customer.findUnique({
      where: { id },
      include: { branch: true, salesOrders: { include: { invoice: true }, orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!c) throw new NotFoundException('Customer not found');
    return c;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.customer.delete({ where: { id } });
  }

  // Customer ledger: all invoices + payments, with running balance
  async ledger(id: string) {
    const orders = await this.prisma.salesOrder.findMany({
      where: { customerId: id, invoice: { isNot: null } },
      include: { invoice: true },
      orderBy: { createdAt: 'asc' },
    });
    let balance = 0;
    return orders.map((o) => {
      const inv = o.invoice!;
      const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount);
      balance += outstanding;
      return { invoiceNo: inv.invoiceNo, date: o.createdAt, totalAmount: inv.totalAmount, paidAmount: inv.paidAmount, outstanding, runningBalance: balance };
    });
  }
}
