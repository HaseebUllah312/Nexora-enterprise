import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: any) {
    const expenseNo = `EXP-${Date.now()}`;
    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: { ...dto, expenseNo, amount: Number(dto.amount) },
        include: { branch: true },
      });

      // Helper function to find or create standard accounts for a branch
      const getBranchAccount = async (name: string, type: 'CASH' | 'BANK' | 'RECEIVABLE' | 'PAYABLE' | 'INCOME' | 'EXPENSE') => {
        let acc = await tx.account.findFirst({
          where: { branchId: expense.branchId, type },
        });
        if (!acc) {
          acc = await tx.account.create({
            data: {
              name: `${expense.branch?.name || 'Branch'} ${name}`,
              type,
              branchId: expense.branchId,
              balance: 0,
            },
          });
        }
        return acc;
      };

      const expAcc = await getBranchAccount('Operating Expenses', 'EXPENSE');
      const cashAcc = await getBranchAccount('Cash in Hand', 'CASH');

      // Debit Expense
      await tx.transaction.create({
        data: {
          accountId: expAcc.id,
          type: 'DEBIT',
          amount: expense.amount,
          description: `Expense Recorded: ${expense.title} (#${expenseNo})`,
          referenceType: 'Expense',
          referenceId: expense.id,
        },
      });
      await tx.account.update({
        where: { id: expAcc.id },
        data: { balance: { increment: expense.amount } },
      });

      // Credit Cash
      await tx.transaction.create({
        data: {
          accountId: cashAcc.id,
          type: 'CREDIT',
          amount: expense.amount,
          description: `Cash payment for Expense: ${expense.title} (#${expenseNo})`,
          referenceType: 'Expense',
          referenceId: expense.id,
        },
      });
      await tx.account.update({
        where: { id: cashAcc.id },
        data: { balance: { increment: -expense.amount } },
      });

      return expense;
    }, { timeout: 30000 });
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
