import { describe, expect, it } from 'vitest';
import { api, createCompanyAndOutlet, createOutletAs, loginOutletUser, registerHq } from '../helpers/api.js';

/**
 * HQ needs outlet-level reporting for operational decisions. These tests define
 * the initial contract for revenue totals and top-selling menu items, including
 * the empty state when an outlet has no sales.
 */
describe('reporting API', () => {
  it('reports total revenue by outlet', async () => {
    const { outlet } = await createCompanyAndOutlet();
    const response = await api.get(`/api/reports/outlets/${outlet.id}/revenue`).expect(200);
    expect(response.body).toHaveProperty('totalRevenue');
  });

  it('returns the top five selling items in descending order', async () => {
    const { outlet } = await createCompanyAndOutlet();
    const response = await api.get(`/api/reports/outlets/${outlet.id}/top-items?limit=5`).expect(200);
    expect(response.body.items).toHaveLength(0);
  });

  it('supports a date range for revenue reports', async () => {
    const { outlet } = await createCompanyAndOutlet();
    const response = await api.get(
      `/api/reports/outlets/${outlet.id}/revenue?from=2026-01-01&to=2026-12-31`
    ).expect(200);

    expect(response.body).toHaveProperty('from', '2026-01-01');
    expect(response.body).toHaveProperty('to', '2026-12-31');
  });

  it('limits top-selling results to five items by default', async () => {
    const { outlet } = await createCompanyAndOutlet();
    const response = await api.get(`/api/reports/outlets/${outlet.id}/top-items`).expect(200);
    expect(response.body.items.length).toBeLessThanOrEqual(5);
  });

  it('rejects a date range where the end precedes the start', async () => {
    const { outlet } = await createCompanyAndOutlet();
    await api.get(`/api/reports/outlets/${outlet.id}/revenue?from=2026-12-31&to=2026-01-01`).expect(400);
  });

  it('includes transactions on both date boundaries', async () => {
    const { outlet } = await createCompanyAndOutlet();
    const response = await api.get(
      `/api/reports/outlets/${outlet.id}/revenue?from=2026-01-01T00:00:00Z&to=2026-01-31T23:59:59Z`
    ).expect(200);
    expect(response.body).toHaveProperty('totalRevenue');
  });

  it('reports revenue and top five items for every company outlet with outlet and date filters', async () => {
    const hq = await registerHq();
    const firstOutlet = await createOutletAs(hq.auth, hq.company.id, 'Downtown');
    const secondOutlet = await createOutletAs(hq.auth, hq.company.id, 'Airport');
    const menuItems = await Promise.all(Array.from({ length: 6 }, (_, index) =>
      api.post('/api/menu-items').set('Authorization', hq.auth)
        .send({ name: `Report Item ${index + 1}`, basePrice: 10 }).expect(201)
    ));

    for (const { body: item } of menuItems) {
      await api.post(`/api/outlets/${firstOutlet.id}/menu-items`).set('Authorization', hq.auth).send({ menuItemId: item.id }).expect(201);
      await api.put(`/api/outlets/${firstOutlet.id}/inventory/${item.id}`).set('Authorization', hq.auth).send({ quantity: 10 }).expect(200);
    }
    await api.post(`/api/outlets/${firstOutlet.id}/sales`).set('Authorization', hq.auth).send({
      items: menuItems.map(({ body: item }, index) => ({ menuItemId: item.id, quantity: index + 1 }))
    }).expect(201);

    const secondOutletItem = menuItems[0].body;
    await api.post(`/api/outlets/${secondOutlet.id}/menu-items`).set('Authorization', hq.auth).send({ menuItemId: secondOutletItem.id }).expect(201);
    await api.put(`/api/outlets/${secondOutlet.id}/inventory/${secondOutletItem.id}`).set('Authorization', hq.auth).send({ quantity: 3 }).expect(200);
    await api.post(`/api/outlets/${secondOutlet.id}/sales`).set('Authorization', hq.auth)
      .send({ items: [{ menuItemId: secondOutletItem.id, quantity: 3 }] }).expect(201);

    const report = await api.get('/api/reports/company').set('Authorization', hq.auth).expect(200);
    expect(report.body.outlets).toHaveLength(2);
    expect(report.body.outlets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        outletId: firstOutlet.id,
        outletName: 'Downtown',
        totalRevenue: 210,
        topItems: expect.arrayContaining([
          expect.objectContaining({ name: 'Report Item 6', quantity: 6 }),
          expect.objectContaining({ name: 'Report Item 5', quantity: 5 })
        ])
      }),
      expect.objectContaining({
        outletId: secondOutlet.id,
        outletName: 'Airport',
        totalRevenue: 30,
        topItems: [expect.objectContaining({ name: 'Report Item 1', quantity: 3 })]
      })
    ]));
    const downtownReport = report.body.outlets.find((outlet: { outletId: string }) => outlet.outletId === firstOutlet.id);
    expect(downtownReport.topItems).toHaveLength(5);
    expect(downtownReport.topItems.map((item: { name: string }) => item.name)).toEqual([
      'Report Item 6',
      'Report Item 5',
      'Report Item 4',
      'Report Item 3',
      'Report Item 2'
    ]);

    const filtered = await api.get(`/api/reports/company?outletId=${firstOutlet.id}&from=2099-01-01&to=2099-12-31`)
      .set('Authorization', hq.auth).expect(200);
    expect(filtered.body.outlets).toEqual([expect.objectContaining({
      outletId: firstOutlet.id,
      totalRevenue: 0,
      topItems: []
    })]);

    const otherCompany = await registerHq('Other Reporting Company');
    const foreignOutlet = await createOutletAs(otherCompany.auth, otherCompany.company.id);
    const crossCompanyFilter = await api.get(`/api/reports/company?outletId=${foreignOutlet.id}`)
      .set('Authorization', hq.auth).expect(200);
    expect(crossCompanyFilter.body.outlets).toEqual([]);
  });

  it('limits the all-outlet report to HQ users', async () => {
    const hq = await registerHq();
    const outlet = await createOutletAs(hq.auth, hq.company.id);
    const outletAuth = await loginOutletUser(hq.auth, hq.company.id, outlet.id);
    await api.get('/api/reports/company').set('Authorization', outletAuth).expect(403);
  });
});
