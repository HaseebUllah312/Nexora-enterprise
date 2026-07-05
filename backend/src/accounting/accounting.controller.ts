import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('accounting')
@UseGuards(RolesGuard)
export class AccountingController {
  constructor(private service: AccountingService) {}

  @Post('accounts') @Roles('SUPER_ADMIN','OWNER','ACCOUNTANT')
  createAccount(@Body() dto: CreateAccountDto) { return this.service.createAccount(dto); }

  @Get('accounts') findAccounts(@Query('branchId') b?: string) { return this.service.findAccounts(b); }
  @Get('accounts/:id') findOne(@Param('id') id: string) { return this.service.findOneAccount(id); }

  @Post('transactions') @Roles('SUPER_ADMIN','OWNER','ACCOUNTANT')
  postTransaction(@Body() dto: CreateTransactionDto) { return this.service.postTransaction(dto); }

  @Get('transactions')
  getTransactions(@Query('accountId') a?: string, @Query('referenceType') r?: string) {
    return this.service.getTransactions(a, r);
  }

  @Get('reports/trial-balance') @Roles('SUPER_ADMIN','OWNER','ACCOUNTANT')
  trialBalance(@Query('branchId') b?: string) { return this.service.trialBalance(b); }

  @Get('reports/profit-and-loss') @Roles('SUPER_ADMIN','OWNER','ACCOUNTANT')
  pnl(@Query('branchId') b?: string, @Query('from') f?: string, @Query('to') t?: string) {
    return this.service.profitAndLoss(b, f, t);
  }

  @Get('reports/balance-sheet') @Roles('SUPER_ADMIN','OWNER','ACCOUNTANT')
  balanceSheet(@Query('branchId') b?: string) { return this.service.balanceSheet(b); }

  @Get('reports/cash-book')
  cashBook(@Query('branchId') b?: string) { return this.service.cashBook(b); }
}
