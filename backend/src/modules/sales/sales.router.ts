import { Router } from 'express';
import { requireOutletAccess } from '@/http/auth';
import { AppError, validateBody, validateParams } from '@/http/errors';
import { createSaleSchema, outletIdParamSchema } from '@/modules/shared/validation/schemas';
import { createSale, fingerprintSale } from './sales.service';

export const salesRouter = Router();

salesRouter.post('/outlets/:outletId/sales', validateParams(outletIdParamSchema), requireOutletAccess, validateBody(createSaleSchema), async (request, response) => {
  const { outletId } = request.params as { outletId: string };
  const result = await createSale(outletId, request.body);
  response.status(201).json(result.sale);
});

salesRouter.post('/outlets/:outletId/sync/sales', validateParams(outletIdParamSchema), requireOutletAccess, validateBody(createSaleSchema), async (request, response) => {
  const { outletId } = request.params as { outletId: string };
  const idempotencyKey = request.get('Idempotency-Key')?.trim();
  if (!idempotencyKey) {
    throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required');
  }

  const result = await createSale(outletId, request.body, {
    idempotencyKey,
    idempotencyFingerprint: fingerprintSale(request.body)
  });
  response.status(result.replayed ? 200 : 201).json(result.sale);
});
