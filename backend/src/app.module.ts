import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule }          from './prisma/prisma.module';
import { AuthModule }            from './auth/auth.module';
import { UsersModule }           from './users/users.module';
import { BranchesModule }        from './branches/branches.module';
import { RolesModule }           from './roles/roles.module';
import { WarehousesModule }      from './warehouses/warehouses.module';
import { CategoriesModule }      from './categories/categories.module';
import { ProductsModule }        from './products/products.module';
import { InventoryModule }       from './inventory/inventory.module';
import { CustomersModule }       from './customers/customers.module';
import { SuppliersModule }       from './suppliers/suppliers.module';
import { SalesModule }           from './sales/sales.module';
import { PurchasesModule }       from './purchases/purchases.module';
import { ManufacturingModule }   from './manufacturing/manufacturing.module';
import { AccountingModule }      from './accounting/accounting.module';
import { EmployeesModule }       from './employees/employees.module';
import { VehiclesModule }        from './vehicles/vehicles.module';
import { NotificationsModule }   from './notifications/notifications.module';
import { DashboardModule }       from './dashboard/dashboard.module';
import { AiAnalyticsModule }     from './ai-analytics/ai-analytics.module';
import { RealtimeModule }        from './realtime/realtime.module';
import { ReportsModule }         from './reports/reports.module';
import { CompanySettingsModule } from './company-settings/company-settings.module';
import { ExpensesModule }        from './expenses/expenses.module';
import { ReturnsModule }         from './returns/returns.module';
import { JwtAuthGuard }          from './auth/guards/jwt-auth.guard';
import { SyncModule }            from './sync/sync.module';
import { HealthModule }          from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule, AuthModule, UsersModule, BranchesModule, RolesModule,
    WarehousesModule, CategoriesModule, ProductsModule, InventoryModule,
    CustomersModule, SuppliersModule, SalesModule, PurchasesModule,
    ManufacturingModule, AccountingModule, EmployeesModule, VehiclesModule,
    NotificationsModule, DashboardModule, AiAnalyticsModule, RealtimeModule,
    ReportsModule, CompanySettingsModule, ExpensesModule, ReturnsModule,
    SyncModule, HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
