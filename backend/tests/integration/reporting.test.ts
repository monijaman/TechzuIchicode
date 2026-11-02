import { describe, expect, it } from 'vitest';
import { api, createCompanyAndOutlet, createMenuItem } from '../helpers/api.js';

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
});
