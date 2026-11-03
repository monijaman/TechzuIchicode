import { Router } from 'express';
import { requireOutletAccess } from '@/http/auth';
import { validateBody, validateParams } from '@/http/errors';
import {
  createInventorySchema,
  outletIdParamSchema,
  outletMenuItemParamsSchema,
  updateInventorySchema
} from '@/modules/shared/validation/schemas';
import { createInventory, getInventory, setInventory } from './inventory.service';

export const inventoryRouter = Router();

inventoryRouter.get('/outlets/:outletId/inventory', validateParams(outletIdParamSchema), requireOutletAccess, async (request, response) => {
  const { outletId } = request.params as { outletId: string };
  response.status(200).json(await getInventory(outletId));
});

inventoryRouter.post('/outlets/:outletId/inventory', validateParams(outletIdParamSchema), requireOutletAccess, validateBody(createInventorySchema), async (request, response) => {
  const { outletId } = request.params as { outletId: string };
  const inventory = await createInventory(outletId, request.body.menuItemId, request.body.quantity);
  response.status(201).json(inventory);
});

inventoryRouter.put('/outlets/:outletId/inventory/:menuItemId', validateParams(outletMenuItemParamsSchema), requireOutletAccess, validateBody(updateInventorySchema), async (request, response) => {
  const { outletId, menuItemId } = request.params as { outletId: string; menuItemId: string };
  response.status(200).json(await setInventory(outletId, menuItemId, request.body.quantity));
});
