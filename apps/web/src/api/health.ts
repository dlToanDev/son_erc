import type { HealthStatus } from '@debtflow/shared';
import { apiGet } from './client';

export function getHealth(): Promise<HealthStatus> {
  return apiGet<HealthStatus>('/health');
}
