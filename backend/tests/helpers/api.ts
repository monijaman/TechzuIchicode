import request from 'supertest';
import { app } from '@/app';

export const api = request(app);

export async function createCompanyAndOutlet() {
  const company = await api
    .post('/api/companies')
    .send({ name: 'Test Company' })
    .expect(201);

  const outlet = await api
    .post(`/api/companies/${company.body.id}/outlets`)
    .send({ name: 'Outlet One' })
    .expect(201);

  return { company: company.body, outlet: outlet.body };
}

export async function createMenuItem(overrides = {}) {
  const response = await api
    .post('/api/menu-items')
    .send({ name: 'Chicken Burger', basePrice: 250, ...overrides })
    .expect(201);

  return response.body;
}

const testPassword = 'a-long-test-password';

/** Registers a real company and HQ user, returning a bearer token for it. */
export async function registerHq(companyName = 'Tenant Company') {
  const response = await api
    .post('/api/auth/register')
    .send({ email: `hq-${crypto.randomUUID()}@example.com`, password: testPassword, companyName })
    .expect(201);

  const token = response.body.tokens.accessToken as string;
  return { token, company: response.body.company, auth: `Bearer ${token}` };
}

export async function createOutletAs(auth: string, companyId: string, name = 'Outlet One') {
  const response = await api.post(`/api/companies/${companyId}/outlets`).set('Authorization', auth).send({ name }).expect(201);
  return response.body;
}

/** Provisions an outlet user through HQ and logs in as that user. */
export async function loginOutletUser(hqAuth: string, companyId: string, outletId: string) {
  const email = `outlet-${crypto.randomUUID()}@example.com`;
  await api.post(`/api/companies/${companyId}/users`).set('Authorization', hqAuth)
    .send({ email, password: testPassword, role: 'OUTLET', outletId }).expect(201);
  const response = await api.post('/api/auth/login').send({ email, password: testPassword }).expect(200);
  return `Bearer ${response.body.tokens.accessToken}`;
}
