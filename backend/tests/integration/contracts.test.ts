import { describe, expect, it } from 'vitest';
import { api, createCompanyAndOutlet, createMenuItem } from '../helpers/api.js';

/**
 * Stable response shapes let the React client and future services evolve
 * independently from the Express implementation.
 */
describe('HTTP API contracts', () => {
  it('returns JSON for successful responses', async () => {
    const response = await api.post('/api/menu-items').send({ name: 'Contract Item', basePrice: 100 }).expect(201);
    expect(response.headers['content-type']).toMatch(/json/);
  });

  it('returns the documented sale response fields', async () => {
    const { outlet } = await createCompanyAndOutlet();
    const item = await createMenuItem();
    await api.post(`/api/outlets/${outlet.id}/menu-items`).send({ menuItemId: item.id }).expect(201);
    await api.put(`/api/outlets/${outlet.id}/inventory/${item.id}`).send({ quantity: 2 }).expect(200);

    const response = await api.post(`/api/outlets/${outlet.id}/sales`)
      .send({ items: [{ menuItemId: item.id, quantity: 1 }] }).expect(201);
    expect(response.body).toEqual(expect.objectContaining({
      id: expect.any(String),
      receiptNumber: expect.any(Number),
      totalAmount: expect.any(Number),
      items: expect.any(Array)
    }));
  });

  it('returns the same error structure for invalid requests', async () => {
    const response = await api.post('/api/menu-items').send({}).expect(400);
    expect(response.body).toEqual(expect.objectContaining({
      error: expect.objectContaining({ code: expect.any(String), message: expect.any(String) })
    }));
  });
});
