import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { FacilitiesModule } from './facilities/facilities.module';
import { SettingsModule } from './settings/settings.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { UsersModule } from './users/users.module';
import { OrdersModule } from './orders/orders.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { PayablesModule } from './payables/payables.module';
import { PaymentsModule } from './payments/payments.module';
import { InventoryModule } from './inventory/inventory.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    // Rate-limit mặc định toàn cục (route login siết chặt hơn bằng @Throttle).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuditModule,
    HealthModule,
    AuthModule,
    FacilitiesModule,
    SettingsModule,
    SuppliersModule,
    UsersModule,
    OrdersModule,
    ReceiptsModule,
    PayablesModule,
    PaymentsModule,
    InventoryModule,
    ReportsModule,
  ],
})
export class AppModule {}
