import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Injectable()
export class AccountingService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    console.log('[Accounting] Checking for unposted historical financial records...');
    try {
      await this.postHistoricalRecords();
      console.log('[Accounting] Historical records sync finished successfully.');
    } catch (e) {
      console.error('[Accounting] Failed to post historical records:', e);
    }
  }

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

  async postHistoricalRecords() {
    // Helper function to find or create standard accounts inside transaction
    const getBranchAccount = async (tx: any, branchId: string, name: string, type: 'CASH' | 'BANK' | 'RECEIVABLE' | 'PAYABLE' | 'INCOME' | 'EXPENSE') => {
      let acc = await tx.account.findFirst({
        where: { branchId, type },
      });
      if (!acc) {
        const branch = await tx.branch.findUnique({ where: { id: branchId } });
        acc = await tx.account.create({
          data: {
            name: `${branch?.name || 'Branch'} ${name}`,
            type,
            branchId,
            balance: 0,
          },
        });
      }
      return acc;
    };

    // 1. Process Sales Invoices
    const salesInvoices = await this.prisma.salesInvoice.findMany({
      include: { salesOrder: true },
    });
    for (const inv of salesInvoices) {
      if (!inv.salesOrder) continue;
      const exists = await this.prisma.transaction.findFirst({
        where: { referenceType: 'SalesInvoice', referenceId: inv.id },
      });
      if (!exists) {
        await this.prisma.$transaction(async (tx) => {
          const revenueAcc = await getBranchAccount(tx, inv.salesOrder.branchId, 'Sales Revenue', 'INCOME');
          
          await tx.transaction.create({
            data: {
              accountId: revenueAcc.id,
              type: 'CREDIT',
              amount: inv.totalAmount,
              description: `Historical Sales Invoice #${inv.invoiceNo}`,
              referenceType: 'SalesInvoice',
              referenceId: inv.id,
              createdAt: inv.createdAt,
            },
          });
          await tx.account.update({
            where: { id: revenueAcc.id },
            data: { balance: { decrement: inv.totalAmount } },
          });

          if (inv.paymentMethod === 'CASH') {
            const cashAcc = await getBranchAccount(tx, inv.salesOrder.branchId, 'Cash in Hand', 'CASH');
            await tx.transaction.create({
              data: {
                accountId: cashAcc.id,
                type: 'DEBIT',
                amount: inv.totalAmount,
                description: `Historical Cash received for Invoice #${inv.invoiceNo}`,
                referenceType: 'SalesInvoice',
                referenceId: inv.id,
                createdAt: inv.createdAt,
              },
            });
            await tx.account.update({
              where: { id: cashAcc.id },
              data: { balance: { increment: inv.totalAmount } },
            });
          } else {
            const recvAcc = await getBranchAccount(tx, inv.salesOrder.branchId, 'Accounts Receivable', 'RECEIVABLE');
            await tx.transaction.create({
              data: {
                accountId: recvAcc.id,
                type: 'DEBIT',
                amount: inv.totalAmount,
                description: `Historical Accounts Receivable created for Invoice #${inv.invoiceNo}`,
                referenceType: 'SalesInvoice',
                referenceId: inv.id,
                createdAt: inv.createdAt,
              },
            });
            await tx.account.update({
              where: { id: recvAcc.id },
              data: { balance: { increment: inv.totalAmount } },
            });
          }
        });
      }

      // Process historical payments
      if (Number(inv.paidAmount) > 0 && inv.paymentMethod === 'CREDIT') {
        const payExists = await this.prisma.transaction.findFirst({
          where: { referenceType: 'SalesInvoicePayment', referenceId: inv.id },
        });
        if (!payExists) {
          await this.prisma.$transaction(async (tx) => {
            const cashAcc = await getBranchAccount(tx, inv.salesOrder.branchId, 'Cash in Hand', 'CASH');
            const recvAcc = await getBranchAccount(tx, inv.salesOrder.branchId, 'Accounts Receivable', 'RECEIVABLE');

            await tx.transaction.create({
              data: {
                accountId: cashAcc.id,
                type: 'DEBIT',
                amount: inv.paidAmount,
                description: `Historical Payment received for Invoice #${inv.invoiceNo}`,
                referenceType: 'SalesInvoicePayment',
                referenceId: inv.id,
                createdAt: inv.createdAt,
              },
            });
            await tx.account.update({
              where: { id: cashAcc.id },
              data: { balance: { increment: inv.paidAmount } },
            });

            await tx.transaction.create({
              data: {
                accountId: recvAcc.id,
                type: 'CREDIT',
                amount: inv.paidAmount,
                description: `Historical Payment credit for Invoice #${inv.invoiceNo}`,
                referenceType: 'SalesInvoicePayment',
                referenceId: inv.id,
                createdAt: inv.createdAt,
              },
            });
            await tx.account.update({
              where: { id: recvAcc.id },
              data: { balance: { decrement: inv.paidAmount } },
            });
          });
        }
      }
    }

    // 2. Process Expenses
    const expenses = await this.prisma.expense.findMany();
    for (const exp of expenses) {
      const exists = await this.prisma.transaction.findFirst({
        where: { referenceType: 'Expense', referenceId: exp.id },
      });
      if (!exists) {
        await this.prisma.$transaction(async (tx) => {
          const expAcc = await getBranchAccount(tx, exp.branchId, 'Operating Expenses', 'EXPENSE');
          const cashAcc = await getBranchAccount(tx, exp.branchId, 'Cash in Hand', 'CASH');

          await tx.transaction.create({
            data: {
              accountId: expAcc.id,
              type: 'DEBIT',
              amount: exp.amount,
              description: `Historical Expense: ${exp.title} (#${exp.expenseNo})`,
              referenceType: 'Expense',
              referenceId: exp.id,
              createdAt: exp.expenseDate,
            },
          });
          await tx.account.update({
            where: { id: expAcc.id },
            data: { balance: { increment: exp.amount } },
          });

          await tx.transaction.create({
            data: {
              accountId: cashAcc.id,
              type: 'CREDIT',
              amount: exp.amount,
              description: `Historical Cash paid for Expense: ${exp.title} (#${exp.expenseNo})`,
              referenceType: 'Expense',
              referenceId: exp.id,
              createdAt: exp.expenseDate,
            },
          });
          await tx.account.update({
            where: { id: cashAcc.id },
            data: { balance: { decrement: exp.amount } },
          });
        });
      }
    }

    // 3. Process Purchase Invoices
    const purchaseInvoices = await this.prisma.purchaseInvoice.findMany({
      include: { purchaseOrder: true },
    });
    for (const inv of purchaseInvoices) {
      if (!inv.purchaseOrder) continue;
      const exists = await this.prisma.transaction.findFirst({
        where: { referenceType: 'PurchaseInvoice', referenceId: inv.id },
      });
      if (!exists) {
        await this.prisma.$transaction(async (tx) => {
          const payAcc = await getBranchAccount(tx, inv.purchaseOrder.branchId, 'Accounts Payable', 'PAYABLE');
          const expAcc = await getBranchAccount(tx, inv.purchaseOrder.branchId, 'Operating Expenses', 'EXPENSE');

          await tx.transaction.create({
            data: {
              accountId: expAcc.id,
              type: 'DEBIT',
              amount: inv.totalAmount,
              description: `Historical Inventory Purchase Invoice #${inv.invoiceNo}`,
              referenceType: 'PurchaseInvoice',
              referenceId: inv.id,
              createdAt: inv.createdAt,
            },
          });
          await tx.account.update({
            where: { id: expAcc.id },
            data: { balance: { increment: inv.totalAmount } },
          });

          await tx.transaction.create({
            data: {
              accountId: payAcc.id,
              type: 'CREDIT',
              amount: inv.totalAmount,
              description: `Historical Accounts Payable recorded for Invoice #${inv.invoiceNo}`,
              referenceType: 'PurchaseInvoice',
              referenceId: inv.id,
              createdAt: inv.createdAt,
            },
          });
          await tx.account.update({
            where: { id: payAcc.id },
            data: { balance: { decrement: inv.totalAmount } },
          });
        });
      }

      // Supplier payments catch-up
      if (Number(inv.paidAmount) > 0) {
        const payExists = await this.prisma.transaction.findFirst({
          where: { referenceType: 'SupplierPayment', referenceId: inv.id },
        });
        if (!payExists) {
          await this.prisma.$transaction(async (tx) => {
            const payAcc = await getBranchAccount(tx, inv.purchaseOrder.branchId, 'Accounts Payable', 'PAYABLE');
            const cashAcc = await getBranchAccount(tx, inv.purchaseOrder.branchId, 'Cash in Hand', 'CASH');

            await tx.transaction.create({
              data: {
                accountId: payAcc.id,
                type: 'DEBIT',
                amount: inv.paidAmount,
                description: `Historical Supplier payment for Invoice #${inv.invoiceNo}`,
                referenceType: 'SupplierPayment',
                referenceId: inv.id,
                createdAt: inv.createdAt,
              },
            });
            await tx.account.update({
              where: { id: payAcc.id },
              data: { balance: { increment: inv.paidAmount } },
            });

            await tx.transaction.create({
              data: {
                accountId: cashAcc.id,
                type: 'CREDIT',
                amount: inv.paidAmount,
                description: `Historical Cash paid for Purchase Invoice #${inv.invoiceNo}`,
                referenceType: 'SupplierPayment',
                referenceId: inv.id,
                createdAt: inv.createdAt,
              },
            });
            await tx.account.update({
              where: { id: cashAcc.id },
              data: { balance: { decrement: inv.paidAmount } },
            });
          });
        }
      }
    }
  }
}
