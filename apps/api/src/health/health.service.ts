import { Injectable } from '@nestjs/common';
import type { HealthStatus } from '@debtflow/shared';

@Injectable()
export class HealthService {
  check(): HealthStatus {
    return {
      status: 'ok',
      service: 'debtflow-api',
      timestamp: new Date().toISOString(),
    };
  }
}
