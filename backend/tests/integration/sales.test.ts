import { describe, expect, it } from 'vitest';
import { api, createCompanyAndOutlet, createMenuItem } from '../helpers/api.js';

async function saleFixture(quantity = 20) {
  const { outlet } = await createCompanyAndOutlet();
  const item = await createMenuItem();
  await api.post(`/api/outlets/${outlet.id}/menu-items`).send({ menuItemId: item.id }).expect(201);
  await api.put(`/api/outlets/${outlet.id}/inventory/${item.id}`).send({ quantity }).expect(200);
  return { outlet, item };
}

/**
 * Sales are the most critical transactional workflow. These tests verify that
 * sale creation, stock deduction, receipt numbering, and rollback behave as a
 * single consistent operation, including under concurrent requests.
 */
describe('sales API', () => {
  it('creates a multi-item sale and deducts inventory', async () => {
    // A successful sale must update both the sale record and the outlet stock.
    const { outlet, item } = await saleFixture();
    const response = await api.post(`/api/outlets/${outlet.id}/sales`).send({ items: [{ menuItemId: item.id, quantity: 2 }] }).expect(201);

    expect(response.body.receiptNumber).toBe(1);
    expect(response.body.items[0].quantity).toBe(2);
    expect(response.body.totalAmount).toBe(500);

    const inventory = await api.get(`/api/outlets/${outlet.id}/inventory`).expect(200);
    expect(inventory.body.items[0].quantity).toBe(18);
  });

  it('rolls back the complete sale when one item is invalid', async () => {
    // The transaction must be all-or-nothing: a failed line cannot partially deduct inventory.
    const { outlet, item } = await saleFixture(2);
    await api.post(`/api/outlets/${outlet.id}/sales`).send({ items: [
      { menuItemId: item.id, quantity: 1 },
      { menuItemId: '00000000-0000-0000-0000-000000000000', quantity: 1 }
    ] }).expect(404);

    const inventory = await api.get(`/api/outlets/${outlet.id}/inventory`).expect(200);
    expect(inventory.body.items[0].quantity).toBe(2);
  });

  it('generates unique sequential receipts per outlet under concurrency', async () => {
    // Concurrent requests must not receive duplicate or skipped receipt numbers for one outlet.
    const { outlet, item } = await saleFixture(100);
    const responses = await Promise.all(Array.from({ length: 10 }, () =>
      api.post(`/api/outlets/${outlet.id}/sales`).send({ items: [{ menuItemId: item.id, quantity: 1 }] })
    ));

    responses.forEach((response) => expect(response.status).toBe(201));
    expect(responses.map((response) => response.body.receiptNumber).sort((a, b) => a - b))
      .toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('starts receipt numbering independently for each outlet', async () => {
    const first = await saleFixture();
    const second = await saleFixture();

    const firstSale = await api.post(`/api/outlets/${first.outlet.id}/sales`)
      .send({ items: [{ menuItemId: first.item.id, quantity: 1 }] }).expect(201);
    const secondSale = await api.post(`/api/outlets/${second.outlet.id}/sales`)
      .send({ items: [{ menuItemId: second.item.id, quantity: 1 }] }).expect(201);

    expect(firstSale.body.receiptNumber).toBe(1);
    expect(secondSale.body.receiptNumber).toBe(1);
  });

  it('allows only one concurrent sale to consume the final stock unit', async () => {
    const { outlet, item } = await saleFixture(1);
    const responses = await Promise.all([
      api.post(`/api/outlets/${outlet.id}/sales`).send({ items: [{ menuItemId: item.id, quantity: 1 }] }),
      api.post(`/api/outlets/${outlet.id}/sales`).send({ items: [{ menuItemId: item.id, quantity: 1 }] })
    ]);

    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
  });
});
