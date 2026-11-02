import { describe, expect, it } from 'vitest';
import { api, createCompanyAndOutlet, createMenuItem } from '../helpers/api.js';

/**
 * Offline POS clients may retry queued sales after reconnecting. Idempotency
 * ensures a retry does not create a duplicate sale or deduct stock twice.
 */
describe('offline POS synchronization', () => {
  it('accepts an offline sale with an idempotency key', async () => {
    const { outlet } = await createCompanyAndOutlet();
    const item = await createMenuItem();
    await api.post(`/api/outlets/${outlet.id}/menu-items`).send({ menuItemId: item.id }).expect(201);
    await api.put(`/api/outlets/${outlet.id}/inventory/${item.id}`).send({ quantity: 5 }).expect(200);

    const response = await api.post(`/api/outlets/${outlet.id}/sync/sales`)
      .set('Idempotency-Key', 'offline-sale-001')
      .send({ items: [{ menuItemId: item.id, quantity: 1 }] })
      .expect(201);

    expect(response.body).toHaveProperty('receiptNumber');
  });

  it('returns the original result for a duplicate offline sale', async () => {
    const { outlet } = await createCompanyAndOutlet();
    const item = await createMenuItem();
    await api.post(`/api/outlets/${outlet.id}/menu-items`).send({ menuItemId: item.id }).expect(201);
    await api.put(`/api/outlets/${outlet.id}/inventory/${item.id}`).send({ quantity: 5 }).expect(200);

    const sale = { items: [{ menuItemId: item.id, quantity: 1 }] };
    const first = await api.post(`/api/outlets/${outlet.id}/sync/sales`)
      .set('Idempotency-Key', 'offline-sale-002').send(sale).expect(201);
    const retry = await api.post(`/api/outlets/${outlet.id}/sync/sales`)
      .set('Idempotency-Key', 'offline-sale-002').send(sale).expect(200);

    expect(retry.body.id).toBe(first.body.id);
    expect(retry.body.receiptNumber).toBe(first.body.receiptNumber);
  });

  it('rejects reuse of an idempotency key with a different payload', async () => {
    const { outlet } = await createCompanyAndOutlet();
    const item = await createMenuItem();
    await api.post(`/api/outlets/${outlet.id}/menu-items`).send({ menuItemId: item.id }).expect(201);
    await api.put(`/api/outlets/${outlet.id}/inventory/${item.id}`).send({ quantity: 5 }).expect(200);

    await api.post(`/api/outlets/${outlet.id}/sync/sales`)
      .set('Idempotency-Key', 'offline-sale-conflict')
      .send({ items: [{ menuItemId: item.id, quantity: 1 }] }).expect(201);
    await api.post(`/api/outlets/${outlet.id}/sync/sales`)
      .set('Idempotency-Key', 'offline-sale-conflict')
      .send({ items: [{ menuItemId: item.id, quantity: 2 }] }).expect(409);
  });
});
