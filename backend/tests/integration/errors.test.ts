import { describe, expect, it } from 'vitest';
import { api } from '../helpers/api.js';

/**
 * Clients need predictable error responses to handle invalid input and missing
 * resources safely. These tests also ensure internal stack traces are not
 * exposed to API consumers.
 */
describe('API validation and errors', () => {
  it('returns a consistent validation error shape', async () => {
    const response = await api.post('/api/menu-items').send({}).expect(400);
    expect(response.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('returns 404 for an unknown route', async () => {
    const response = await api.get('/api/does-not-exist').expect(404);
    expect(response.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('does not leak stack traces in production errors', async () => {
    const response = await api.get('/api/does-not-exist').expect(404);
    expect(response.body.error).not.toHaveProperty('stack');
  });
});
