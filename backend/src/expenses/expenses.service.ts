import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: any) {
    const expenseNo = `EXP-${Date.now()}`;
    return this.prisma.expense.create({
      data: { ...dto, expenseNo, amount: Number(dto.amount) },
      include: { branch: true },
    });
  }

  findAll(branchId?: string, from?: string, to?: string, category?: string) {
    return this.prisma.expense.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(category ? { category } : {}),
        ...(from || to ? {
          expenseDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to   ? { lte: new Date(to)   } : {}),
          },
        } : {}),
      },
      include: { branch: true },
      orderBy: { expenseDate: 'desc' },
    });
  }

  async summary(branchId?: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [all, thisMonth] = await Promise.all([
      this.prisma.expense.aggregate({
        where: branchId ? { branchId } : {},
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: {
          ...(branchId ? { branchId } : {}),
          expenseDate: { gte: monthStart },
        },
        _sum: { amount: true },
      }),
    ]);
    const byCategory = await this.prisma.expense.groupBy({
      by: ['category'],
      where: branchId ? { branchId } : {},
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    });
    return {
      totalExpenses: Number(all._sum.amount ?? 0),
      monthlyExpenses: Number(thisMonth._sum.amount ?? 0),
      byCategory: byCategory.map(c => ({ category: c.category, total: Number(c._sum.amount ?? 0) })),
    };
  }

  async remove(id: string) {
    const e = await this.prisma.expense.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Expense not found');
    return this.prisma.expense.delete({ where: { id } });
  }
}
