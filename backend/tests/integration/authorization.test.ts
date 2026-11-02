import { describe, expect, it } from 'vitest';
import { api, createCompanyAndOutlet, createMenuItem } from '../helpers/api.js';

/**
 * Role and outlet boundaries protect HQ data and prevent one outlet from
 * changing another outlet's menu, inventory, or sales.
 */
describe('authorization boundaries', () => {
  it('allows HQ users to create master menu items', async () => {
    await api.post('/api/menu-items').set('x-test-role', 'hq')
      .send({ name: 'HQ Item', basePrice: 100 }).expect(201);
  });

  it('rejects outlet users from creating master menu items', async () => {
    await api.post('/api/menu-items').set('x-test-role', 'outlet')
      .send({ name: 'Unauthorized Item', basePrice: 100 }).expect(403);
  });

  it('rejects one outlet from updating another outlet inventory', async () => {
    const first = await createCompanyAndOutlet();
    const second = await createCompanyAndOutlet();
    const item = await createMenuItem();

    await api.post(`/api/outlets/${second.outlet.id}/menu-items`).send({ menuItemId: item.id }).expect(201);
    await api.put(`/api/outlets/${second.outlet.id}/inventory/${item.id}`)
      .set('x-outlet-id', first.outlet.id)
      .send({ quantity: 10 }).expect(403);
  });
});
