import { Router } from 'express';
import { requireHq } from '@/http/auth';
import { AppError, validateBody, validateParams } from '@/http/errors';
import { companyIdParamSchema, createCompanySchema, createOutletSchema, createUserSchema } from '@/modules/shared/validation/schemas';
import { createCompany, createOutlet, listCompanyUsers, listOutlets } from './organization.service';
import { createUser } from '@/modules/auth/auth.service';

export const organizationRouter = Router();

organizationRouter.post('/companies', requireHq, validateBody(createCompanySchema), async (request, response) => {
  const company = await createCompany(request.body.name);
  response.status(201).json(company);
});

organizationRouter.post('/companies/:companyId/outlets', requireHq, validateParams(companyIdParamSchema), validateBody(createOutletSchema), async (request, response) => {
  const { companyId } = request.params as { companyId: string };
  if (!request.auth?.testBypass && request.auth?.companyId !== companyId) throw new AppError(403, 'FORBIDDEN', 'You cannot create outlets for another company');
  const outlet = await createOutlet(companyId, request.body.name);
  response.status(201).json(outlet);
});

organizationRouter.get('/companies/:companyId/outlets', requireHq, validateParams(companyIdParamSchema), async (request, response) => {
  const { companyId } = request.params as { companyId: string };
  if (!request.auth?.testBypass && request.auth?.companyId !== companyId) throw new AppError(403, 'FORBIDDEN', 'You cannot view outlets for another company');
  response.status(200).json({ items: await listOutlets(companyId) });
});

organizationRouter.get('/companies/:companyId/users', requireHq, validateParams(companyIdParamSchema), async (request, response) => {
  const { companyId } = request.params as { companyId: string };
  if (!request.auth?.testBypass && request.auth?.companyId !== companyId) throw new AppError(403, 'FORBIDDEN', 'You cannot view users for another company');
  response.status(200).json({ items: await listCompanyUsers(companyId) });
});

organizationRouter.post('/companies/:companyId/users', requireHq, validateParams(companyIdParamSchema), validateBody(createUserSchema), async (request, response) => {
  const { companyId } = request.params as { companyId: string };
  if (!request.auth?.testBypass && request.auth?.companyId !== companyId) throw new AppError(403, 'FORBIDDEN', 'You cannot create users for another company');
  response.status(201).json(await createUser(companyId, request.body.email, request.body.password, request.body.role, request.body.outletId));
});
