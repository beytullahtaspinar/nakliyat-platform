import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { CompaniesModule } from './companies/companies.module.js';
import { EventsModule } from './events/domain-events.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { ImpersonationAuditInterceptor } from './common/interceptors/impersonation-audit.interceptor.js';
import { HealthController } from './health/health.controller.js';
import { LocationsController } from './locations/locations.controller.js';
import { MediaModule } from './media/media.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ObservabilityModule } from './observability/observability.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { QuotesModule } from './quotes/quotes.module.js';
import { RequestsModule } from './requests/requests.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ObservabilityModule,
    // IP başına dakikada 120 istek. Tarayıcı testleri tüm istekleri tek IP'den yaptığı için RATE_LIMIT ile
    // yükseltir; canlıda tanımlanmaz.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: Number(process.env.RATE_LIMIT) || 120 }]),
    PrismaModule,
    EventsModule,
    AuthModule,
    RequestsModule,
    MediaModule,
    CompaniesModule,
    QuotesModule,
    BookingsModule,
    AdminModule,
    NotificationsModule,
  ],
  controllers: [HealthController, LocationsController],
  providers: [
    // Sıra önemli: önce hız sınırı, sonra kimlik, sonra rol kontrolü.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: ImpersonationAuditInterceptor },
  ],
})
export class AppModule {}
