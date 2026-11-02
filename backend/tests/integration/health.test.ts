import { describe, expect, it } from 'vitest';
import { api } from '../helpers/api.js';

/**
 * Deployment platforms use health endpoints to decide whether the application
 * can receive traffic and whether its database dependency is available.
 */
describe('health endpoints', () => {
  it('reports that the application is alive', async () => {
    const response = await api.get('/health').expect(200);
    expect(response.body).toMatchObject({ status: 'ok' });
  });

  it('reports database readiness', async () => {
    const response = await api.get('/ready').expect(200);
    expect(response.body).toMatchObject({ status: 'ready', database: 'up' });
  });

  it('reports not-ready when the database dependency is unavailable', async () => {
    const response = await api.get('/ready?simulateDatabaseFailure=true').expect(503);
    expect(response.body).toMatchObject({ status: 'not_ready', database: 'down' });
  });
});
