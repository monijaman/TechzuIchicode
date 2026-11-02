import { describe, expect, it } from 'vitest';
import { api, createCompanyAndOutlet, createMenuItem } from '../helpers/api.js';

async function prepareInventory(quantity = 10) {
  const { outlet } = await createCompanyAndOutlet();
  const item = await createMenuItem();
  await api.post(`/api/outlets/${outlet.id}/menu-items`).send({ menuItemId: item.id }).expect(201);
  await api.put(`/api/outlets/${outlet.id}/inventory/${item.id}`).send({ quantity }).expect(200);
  return { outlet, item };
}

/**
 * Inventory is maintained independently for every outlet. These tests ensure
 * stock cannot become negative and that an invalid sale does not alter stock.
 */
describe('inventory API', () => {
  it('tracks stock independently per outlet', async () => {
    // Stock belongs to an outlet, so one location must not affect another location's inventory.
    const first = await prepareInventory(10);
    const second = await prepareInventory(25);

    const firstStock = await api.get(`/api/outlets/${first.outlet.id}/inventory`).expect(200);
    const secondStock = await api.get(`/api/outlets/${second.outlet.id}/inventory`).expect(200);

    expect(firstStock.body.items[0].quantity).toBe(10);
    expect(secondStock.body.items[0].quantity).toBe(25);
  });

  it('rejects negative stock values', async () => {
    const { outlet, item } = await prepareInventory();
    await api.put(`/api/outlets/${outlet.id}/inventory/${item.id}`).send({ quantity: -1 }).expect(400);
  });

  it('rejects sales that would create negative stock', async () => {
    // The failed sale must leave the original stock untouched.
    const { outlet, item } = await prepareInventory(2);
    await api.post(`/api/outlets/${outlet.id}/sales`).send({ items: [{ menuItemId: item.id, quantity: 3 }] }).expect(409);

    const inventory = await api.get(`/api/outlets/${outlet.id}/inventory`).expect(200);
    expect(inventory.body.items[0].quantity).toBe(2);
  });
});
