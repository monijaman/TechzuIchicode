import express from 'express';
import { prisma } from '@/database/prisma';
import { errorHandler, notFoundHandler } from '@/http/errors';
import { requireAuth } from '@/http/auth';
import { authRouter } from '@/modules/auth/auth.router';
import { inventoryRouter } from '@/modules/inventory/inventory.router';
import { menuRouter } from '@/modules/menu/menu.router';
import { organizationRouter } from '@/modules/organization/organization.router';
import { reportingRouter } from '@/modules/reporting/reporting.router';
import { salesRouter } from '@/modules/sales/sales.router';

export const app = express();

app.use((request, response, next) => {
  const origin = request.get('Origin');
  const allowedOrigin = process.env.FRONTEND_ORIGIN;
  if (origin && allowedOrigin && origin === allowedOrigin) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  }
  if (request.method === 'OPTIONS') return response.sendStatus(204);
  next();
});

app.use(express.json());

app.get('/health', (_request, response) => {
  response.status(200).json({ status: 'ok' });
});

app.get('/ready', async (request, response) => {
  if (request.query.simulateDatabaseFailure === 'true') {
    response.status(503).json({ status: 'not_ready', database: 'down' });
    return;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    response.status(200).json({ status: 'ready', database: 'up' });
  } catch {
    response.status(503).json({ status: 'not_ready', database: 'down' });
  }
});

app.use('/api', authRouter);
app.use('/api', requireAuth);
app.use('/api', organizationRouter);
app.use('/api', menuRouter);
app.use('/api', inventoryRouter);
app.use('/api', salesRouter);
app.use('/api', reportingRouter);

app.use(notFoundHandler);
app.use(errorHandler);
