import { afterAll, afterEach, beforeAll } from 'vitest';
import { prisma } from '@/database/prisma';
import { resetTestDatabase } from '@/database/reset';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://fb_user:fb_password@localhost:5432/fb_outlet_test';

beforeAll(async () => {
  await prisma.$connect();
  await resetTestDatabase();
});

afterEach(async () => {
  await resetTestDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});
