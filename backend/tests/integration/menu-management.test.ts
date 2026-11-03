import { describe, expect, it } from 'vitest';
import { api, createOutletAs, registerHq } from '../helpers/api.js';

describe('master menu management', () => {
  async function setup() {
    const hq = await registerHq();
    const item = await api.post('/api/menu-items').set('Authorization', hq.auth).send({ name: 'Burger', basePrice: 100 }).expect(201);
    return { hq, item: item.body };
  }

  it('updates a menu item name and base price', async () => {
    const { hq, item } = await setup();
    const response = await api.put(`/api/menu-items/${item.id}`).set('Authorization', hq.auth)
      .send({ name: 'Cheese Burger', basePrice: 120.5 }).expect(200);
    expect(response.body).toMatchObject({ id: item.id, name: 'Cheese Burger', basePrice: 120.5 });
  });

  it('rejects an empty update', async () => {
    const { hq, item } = await setup();
    await api.put(`/api/menu-items/${item.id}`).set('Authorization', hq.auth).send({}).expect(400);
  });

  it('hides another company menu item from update and delete', async () => {
    const { item } = await setup();
    const other = await registerHq('Other Company');
    await api.put(`/api/menu-items/${item.id}`).set('Authorization', other.auth).send({ basePrice: 1 }).expect(404);
    await api.delete(`/api/menu-items/${item.id}`).set('Authorization', other.auth).expect(404);
  });

  it('deletes an unused menu item', async () => {
    const { hq, item } = await setup();
    await api.delete(`/api/menu-items/${item.id}`).set('Authorization', hq.auth).expect(204);
    const response = await api.get('/api/menu-items').set('Authorization', hq.auth).expect(200);
    expect(response.body.items).toEqual([]);
  });

  it('blocks deleting an assigned item until it is unassigned', async () => {
    const { hq, item } = await setup();
    const outlet = await createOutletAs(hq.auth, hq.company.id);
    await api.post(`/api/outlets/${outlet.id}/menu-items`).set('Authorization', hq.auth).send({ menuItemId: item.id }).expect(201);

    const blocked = await api.delete(`/api/menu-items/${item.id}`).set('Authorization', hq.auth).expect(409);
    expect(blocked.body.error.code).toBe('MENU_ITEM_IN_USE');

    await api.delete(`/api/outlets/${outlet.id}/menu-items/${item.id}`).set('Authorization', hq.auth).expect(204);
    await api.delete(`/api/menu-items/${item.id}`).set('Authorization', hq.auth).expect(204);
  });

  it('keeps sold items for receipt history', async () => {
    const { hq, item } = await setup();
    const outlet = await createOutletAs(hq.auth, hq.company.id);
    await api.post(`/api/outlets/${outlet.id}/menu-items`).set('Authorization', hq.auth).send({ menuItemId: item.id }).expect(201);
    await api.put(`/api/outlets/${outlet.id}/inventory/${item.id}`).set('Authorization', hq.auth).send({ quantity: 5 }).expect(200);
    await api.post(`/api/outlets/${outlet.id}/sales`).set('Authorization', hq.auth).send({ items: [{ menuItemId: item.id, quantity: 1 }] }).expect(201);
    await api.delete(`/api/outlets/${outlet.id}/menu-items/${item.id}`).set('Authorization', hq.auth).expect(204);

    await api.delete(`/api/menu-items/${item.id}`).set('Authorization', hq.auth).expect(409);
  });

  it('returns the outlet id in the outlet user login response', async () => {
    const hq = await registerHq();
    const outlet = await createOutletAs(hq.auth, hq.company.id);
    await api.post(`/api/companies/${hq.company.id}/users`).set('Authorization', hq.auth)
      .send({ email: 'cashier@example.com', password: 'a-long-test-password', role: 'OUTLET', outletId: outlet.id }).expect(201);
    const login = await api.post('/api/auth/login').send({ email: 'cashier@example.com', password: 'a-long-test-password' }).expect(200);
    expect(login.body.user).toMatchObject({ role: 'OUTLET', companyId: hq.company.id, outletId: outlet.id });

    const refreshed = await api.post('/api/auth/refresh').send({ refreshToken: login.body.tokens.refreshToken }).expect(200);
    expect(refreshed.body.user).toMatchObject({ companyId: hq.company.id, outletId: outlet.id });
  });
});
