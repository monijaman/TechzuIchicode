import { describe, expect, it } from 'vitest';
import { api, createCompanyAndOutlet, createMenuItem } from '../helpers/api.js';

/**
 * These tests protect the API from incomplete payloads, invalid identifiers,
 * duplicate records, and empty operations that should never reach the database.
 */
describe('API edge cases', () => {
  it('rejects an empty sale', async () => {
    const { outlet } = await createCompanyAndOutlet();
    await api.post(`/api/outlets/${outlet.id}/sales`).send({ items: [] }).expect(400);
  });

  it('rejects a sale with a missing quantity', async () => {
    const { outlet } = await createCompanyAndOutlet();
    const item = await createMenuItem();
    await api.post(`/api/outlets/${outlet.id}/sales`).send({ items: [{ menuItemId: item.id }] }).expect(400);
  });

  it('rejects a sale containing an unassigned menu item', async () => {
    const { outlet } = await createCompanyAndOutlet();
    const item = await createMenuItem();
    await api.post(`/api/outlets/${outlet.id}/sales`).send({ items: [{ menuItemId: item.id, quantity: 1 }] }).expect(409);
  });

  it('returns 404 for an unknown menu item', async () => {
    const { outlet } = await createCompanyAndOutlet();
    await api.post(`/api/outlets/${outlet.id}/menu-items`).send({
      menuItemId: '00000000-0000-0000-0000-000000000000'
    }).expect(404);
  });

  it('rejects invalid pagination and report limits', async () => {
    const { outlet } = await createCompanyAndOutlet();
    await api.get(`/api/reports/outlets/${outlet.id}/top-items?limit=0`).expect(400);
    await api.get(`/api/reports/outlets/${outlet.id}/top-items?limit=101`).expect(400);
  });
});
