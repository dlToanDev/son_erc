import { HealthService } from './health.service';

describe('HealthService', () => {
  const service = new HealthService();

  it('returns ok status for debtflow-api', () => {
    const result = service.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('debtflow-api');
  });

  it('returns a valid ISO timestamp', () => {
    const result = service.check();
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});
