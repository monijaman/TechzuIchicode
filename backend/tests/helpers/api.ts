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
