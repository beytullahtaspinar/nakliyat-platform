import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { APP_RELEASE } from '../observability/error-reporter.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('Sistem')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'down' });
    }
    // release: kurulu sürüm etiketi; deploy betiği yeni sürümün gerçekten açıldığını bununla doğrular
    return { status: 'ok', database: 'up', release: APP_RELEASE ?? 'yerel' };
  }
}
