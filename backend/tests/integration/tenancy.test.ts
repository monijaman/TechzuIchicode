import { describe, expect, it } from 'vitest';
import { api, createOutletAs, loginOutletUser, registerHq } from '../helpers/api.js';

/**
 * These tests use real bearer tokens, not the legacy test headers, so they
 * exercise the production company and role checks end to end.
 */
describe('tenant isolation with bearer tokens', () => {
  it('lists only the caller company menu items', async () => {
    const first = await registerHq('First Company');
    const second = await registerHq('Second Company');
    await api.post('/api/menu-items').set('Authorization', first.auth).send({ name: 'First Burger', basePrice: 100 }).expect(201);

    const response = await api.get('/api/menu-items').set('Authorization', second.auth).expect(200);
    expect(response.body.items).toEqual([]);
  });

  it('does not let one company assign another company menu item', async () => {
    const first = await registerHq('First Company');
    const second = await registerHq('Second Company');
    const item = await api.post('/api/menu-items').set('Authorization', first.auth).send({ name: 'First Burger', basePrice: 100 }).expect(201);
    const outlet = await createOutletAs(second.auth, second.company.id);

    await api.post(`/api/outlets/${outlet.id}/menu-items`).set('Authorization', second.auth)
      .send({ menuItemId: item.body.id }).expect(404);
  });

  it('rejects creating outlets for another company', async () => {
    const first = await registerHq('First Company');
    const second = await registerHq('Second Company');

    await api.post(`/api/companies/${first.company.id}/outlets`).set('Authorization', second.auth)
      .send({ name: 'Intruder Outlet' }).expect(403);
  });

  it('rejects HQ access to another company outlet inventory', async () => {
    const first = await registerHq('First Company');
    const second = await registerHq('Second Company');
    const outlet = await createOutletAs(first.auth, first.company.id);

    await api.get(`/api/outlets/${outlet.id}/inventory`).set('Authorization', second.auth).expect(403);
  });

  it('rejects outlet users assigning menu items or overriding prices', async () => {
    const hq = await registerHq();
    const outlet = await createOutletAs(hq.auth, hq.company.id);
    const item = await api.post('/api/menu-items').set('Authorization', hq.auth).send({ name: 'Burger', basePrice: 100 }).expect(201);
    const outletAuth = await loginOutletUser(hq.auth, hq.company.id, outlet.id);

    await api.post(`/api/outlets/${outlet.id}/menu-items`).set('Authorization', outletAuth)
      .send({ menuItemId: item.body.id }).expect(403);
    await api.post(`/api/outlets/${outlet.id}/menu-items`).set('Authorization', hq.auth)
      .send({ menuItemId: item.body.id }).expect(201);
    await api.put(`/api/outlets/${outlet.id}/menu-items/${item.body.id}/price`).set('Authorization', outletAuth)
      .send({ price: 1 }).expect(403);
  });

  it('lets an outlet user read its own assigned menu', async () => {
    const hq = await registerHq();
    const outlet = await createOutletAs(hq.auth, hq.company.id);
    const item = await api.post('/api/menu-items').set('Authorization', hq.auth).send({ name: 'Burger', basePrice: 100 }).expect(201);
    await api.post(`/api/outlets/${outlet.id}/menu-items`).set('Authorization', hq.auth).send({ menuItemId: item.body.id }).expect(201);
    const outletAuth = await loginOutletUser(hq.auth, hq.company.id, outlet.id);

    const response = await api.get(`/api/outlets/${outlet.id}/menu`).set('Authorization', outletAuth).expect(200);
    expect(response.body.items).toEqual([{ id: item.body.id, name: 'Burger', price: 100 }]);
  });
});
