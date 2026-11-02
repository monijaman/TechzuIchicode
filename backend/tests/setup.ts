import { afterAll, beforeAll } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://fb_user:fb_password@localhost:5432/fb_outlet_test';

beforeAll(async () => {
  // The implementation will connect Prisma to the test database here.
});

afterAll(async () => {
  // The implementation will disconnect Prisma here.
});
