import { Router } from 'express';
import { requireHq, requireOutletAccess } from '@/http/auth';
import { validateParams, validateQuery } from '@/http/errors';
import { companyReportQuerySchema, outletIdParamSchema, revenueReportQuerySchema, topItemsReportQuerySchema } from '@/modules/shared/validation/schemas';
import { getCompanySalesReport, getRevenueReport, getTopItemsReport } from './reporting.service';

export const reportingRouter = Router();

reportingRouter.get('/reports/company', requireHq, validateQuery(companyReportQuerySchema), async (request, response) => {
  const filter = response.locals.query as { outletId?: string; from?: string; to?: string };
  response.status(200).json(await getCompanySalesReport(request.auth!.companyId, filter));
});

reportingRouter.get('/reports/outlets/:outletId/revenue', validateParams(outletIdParamSchema), requireOutletAccess, validateQuery(revenueReportQuerySchema), async (request, response) => {
  const { outletId } = request.params as { outletId: string };
  const range = response.locals.query as { from?: string; to?: string };
  response.status(200).json(await getRevenueReport(outletId, range));
});

reportingRouter.get('/reports/outlets/:outletId/top-items', validateParams(outletIdParamSchema), requireOutletAccess, validateQuery(topItemsReportQuerySchema), async (request, response) => {
  const { outletId } = request.params as { outletId: string };
  const { limit } = response.locals.query as { limit: number };
  response.status(200).json(await getTopItemsReport(outletId, limit));
});
