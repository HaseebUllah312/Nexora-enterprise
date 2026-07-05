import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Injectable()
export class AccountingService {
  constructor(private prisma: PrismaService) {}

  // ── CHART OF ACCOUNTS ─────────────────────────────────────────────────
  createAccount(dto: CreateAccountDto) {
    return this.prisma.account.create({ data: { ...dto, type: dto.type as any } });
  }

  findAccounts(branchId?: string) {
    return this.prisma.account.findMany({
      where: branchId ? { branchId } : undefined,
      include: { branch: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async findOneAccount(id: string) {
    const a = await this.prisma.account.findUnique({
      where: { id },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 100 } },
    });
    if (!a) throw new NotFoundException('Account not found');
    return a;
  }

  // ── JOURNAL ENTRIES / TRANSACTIONS ────────────────────────────────────
  async postTransaction(dto: CreateTransactionDto) {
    const account = await this.prisma.account.findUnique({ where: { id: dto.accountId } });
    if (!account) throw new NotFoundException('Account not found');

    return this.prisma.$transaction(async (tx) => {
      const txn = await tx.transaction.create({
        data: { ...dto, type: dto.type as any },
      });
      // Update account running balance
      const delta = dto.type === 'DEBIT' ? Number(dto.amount) : -Number(dto.amount);
      await tx.account.update({ where: { id: dto.accountId }, data: { balance: { increment: delta } } });
      return txn;
    }, { timeout: 30000 });
  }

  getTransactions(accountId?: string, referenceType?: string) {
    return this.prisma.transaction.findMany({
      where: {
        ...(accountId ? { accountId } : {}),
        ...(referenceType ? { referenceType } : {}),
      },
      include: { account: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  // ── REPORTS ───────────────────────────────────────────────────────────

  // Trial Balance: every account with its current balance (debits positive, credits negative)
  async trialBalance(branchId?: string) {
    const accounts = await this.prisma.account.findMany({
      where: branchId ? { branchId } : undefined,
      include: { branch: true },
    });
    const debits = accounts.filter((a) => Number(a.balance) > 0).reduce((s, a) => s + Number(a.balance), 0);
    const credits = accounts.filter((a) => Number(a.balance) < 0).reduce((s, a) => s + Math.abs(Number(a.balance)), 0);
    return { accounts, totalDebits: debits, totalCredits: credits, isBalanced: Math.abs(debits - credits) < 0.01 };
  }

  // P&L: income minus expenses over a date range
  async profitAndLoss(branchId?: string, from?: string, to?: string) {
    const dateFilter = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };

    const incomeAccounts = await this.prisma.account.findMany({
      where: { type: 'INCOME', ...(branchId ? { branchId } : {}) },
    });
    const expenseAccounts = await this.prisma.account.findMany({
      where: { type: 'EXPENSE', ...(branchId ? { branchId } : {}) },
    });

    const sumTransactions = async (accountIds: string[], type: 'CREDIT' | 'DEBIT') => {
      const txns = await this.prisma.transaction.aggregate({
        where: { accountId: { in: accountIds }, type, createdAt: Object.keys(dateFilter).length ? dateFilter : undefined },
        _sum: { amount: true },
      });
      return Number(txns._sum.amount ?? 0);
    };

    const totalIncome = await sumTransactions(incomeAccounts.map((a) => a.id), 'CREDIT');
    const totalExpenses = await sumTransactions(expenseAccounts.map((a) => a.id), 'DEBIT');
    const netProfit = totalIncome - totalExpenses;

    return {
      totalIncome,
      totalExpenses,
      netProfit,
      incomeAccounts,
      expenseAccounts,
      period: { from, to },
    };
  }

  // Balance Sheet: Assets = Liabilities + Equity
  async balanceSheet(branchId?: string) {
    const accounts = await this.prisma.account.findMany({
      where: branchId ? { branchId } : undefined,
    });
    const group = (types: string[]) =>
      accounts.filter((a) => types.includes(a.type)).reduce((s, a) => s + Math.abs(Number(a.balance)), 0);

    return {
      assets: {
        cash: group(['CASH']),
        bank: group(['BANK']),
        receivables: group(['RECEIVABLE']),
        total: group(['CASH', 'BANK', 'RECEIVABLE']),
      },
      liabilities: {
        payables: group(['PAYABLE']),
        total: group(['PAYABLE']),
      },
      equity: {
        total: group(['EQUITY', 'INCOME']) - group(['EXPENSE']),
      },
    };
  }

  async cashBook(branchId?: string) {
    const cashAccounts = await this.prisma.account.findMany({
      where: { type: 'CASH', ...(branchId ? { branchId } : {}) },
    });
    const accountIds = cashAccounts.map((a) => a.id);
    const transactions = await this.prisma.transaction.findMany({
      where: { accountId: { in: accountIds } },
      include: { account: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return { cashAccounts, transactions };
  }
}
