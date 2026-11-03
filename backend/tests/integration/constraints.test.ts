import { describe, expect, it } from 'vitest';
import { api, createCompanyAndOutlet, createMenuItem, registerHq } from '../helpers/api.js';

/**
 * PostgreSQL constraints are the final protection against invalid data when
 * application-level validation is bypassed or concurrent requests race.
 */
describe('database integrity constraints', () => {
  it('rejects duplicate inventory for the same outlet and item', async () => {
    const { outlet } = await createCompanyAndOutlet();
    const item = await createMenuItem();
    await api.post(`/api/outlets/${outlet.id}/menu-items`).send({ menuItemId: item.id }).expect(201);
    await api.put(`/api/outlets/${outlet.id}/inventory/${item.id}`).send({ quantity: 5 }).expect(200);
    await api.post(`/api/outlets/${outlet.id}/inventory`).send({ menuItemId: item.id, quantity: 5 }).expect(409);
  });

  it('rejects a sale referencing a deleted or unknown outlet', async () => {
    const { auth } = await registerHq();
    await api.post('/api/outlets/00000000-0000-0000-0000-000000000000/sales').set('Authorization', auth)
      .send({ items: [] }).expect(404);
  });

  it('rejects malformed identifiers before database access', async () => {
    await api.get('/api/outlets/not-a-uuid/menu').expect(400);
  });
});
