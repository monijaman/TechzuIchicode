import { describe, expect, it } from 'vitest';
import { api, createCompanyAndOutlet, createMenuItem, createOutletAs, registerHq } from '../helpers/api.js';

/**
 * Each company and outlet must be isolated from every other tenant. These tests
 * prevent accidental data leakage through IDs, menu queries, and inventory APIs.
 */
describe('company and outlet data isolation', () => {
  it('does not show one company menu items to another company', async () => {
    const first = await createCompanyAndOutlet();
    const second = await createCompanyAndOutlet();
    const item = await createMenuItem({ name: 'Private Menu Item' });

    await api.post(`/api/outlets/${first.outlet.id}/menu-items`).send({ menuItemId: item.id }).expect(201);

    const response = await api.get(`/api/outlets/${second.outlet.id}/menu`).expect(200);
    expect(response.body.items).toEqual([]);
  });

  it('rejects access to another outlet inventory', async () => {
    const first = await registerHq('First Company');
    const second = await registerHq('Second Company');
    const outlet = await createOutletAs(first.auth, first.company.id);

    await api.get(`/api/outlets/${outlet.id}/inventory`).set('Authorization', second.auth).expect(403);
  });

  it('rejects unknown outlet IDs', async () => {
    await api.get('/api/outlets/00000000-0000-0000-0000-000000000000/menu').expect(404);
  });
});
