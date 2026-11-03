import { describe, expect, it } from 'vitest';
import { api, createCompanyAndOutlet, createMenuItem } from '../helpers/api.js';

/**
 * HQ owns the master menu, but each outlet may use only the items assigned to
 * it. These tests also protect outlet-specific pricing and duplicate-assignment
 * rules exposed through the HTTP API.
 */
describe('menu and outlet assignment API', () => {
  it('creates a master menu item', async () => {
    const item = await createMenuItem();
    expect(item).toMatchObject({ name: 'Chicken Burger', basePrice: 250 });
  });

  it('assigns a menu item to an outlet', async () => {
    const { outlet } = await createCompanyAndOutlet();
    const item = await createMenuItem();

    const response = await api
      .post(`/api/outlets/${outlet.id}/menu-items`)
      .send({ menuItemId: item.id })
      .expect(201);

    expect(response.body).toMatchObject({ outletId: outlet.id, menuItemId: item.id });
  });

  it('supports an outlet-specific price override', async () => {
    const { outlet } = await createCompanyAndOutlet();
    const item = await createMenuItem();

    await api.post(`/api/outlets/${outlet.id}/menu-items`).send({ menuItemId: item.id }).expect(201);
    await api.put(`/api/outlets/${outlet.id}/menu-items/${item.id}/price`).send({ price: 275 }).expect(200);

    const menu = await api.get(`/api/outlets/${outlet.id}/menu`).expect(200);
    expect(menu.body.items[0].price).toBe(275);
  });

  it('returns only assigned items for an outlet', async () => {
    // Outlet users must not see master-menu items that HQ has not assigned to their outlet.
    const { outlet } = await createCompanyAndOutlet();
    const assigned = await createMenuItem({ name: 'Assigned' });
    await createMenuItem({ name: 'Not Assigned' });

    await api.post(`/api/outlets/${outlet.id}/menu-items`).send({ menuItemId: assigned.id }).expect(201);
    const menu = await api.get(`/api/outlets/${outlet.id}/menu`).expect(200);

    expect(menu.body.items.map((item: { name: string }) => item.name)).toEqual(['Assigned']);
  });

  it('rejects duplicate menu assignments', async () => {
    const { outlet } = await createCompanyAndOutlet();
    const item = await createMenuItem();

    await api.post(`/api/outlets/${outlet.id}/menu-items`).send({ menuItemId: item.id }).expect(201);
    await api.post(`/api/outlets/${outlet.id}/menu-items`).send({ menuItemId: item.id }).expect(409);
  });
});
