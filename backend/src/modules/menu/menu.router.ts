import { Router } from 'express';
import { requireHq, requireOutletAccess } from '@/http/auth';
import { validateBody, validateParams } from '@/http/errors';
import {
  assignMenuItemSchema,
  createMenuItemSchema,
  outletIdParamSchema,
  outletMenuItemParamsSchema,
  updateOutletMenuPriceSchema
} from '@/modules/shared/validation/schemas';
import { assignMenuItem, createMenuItem, getOutletMenu, listMenuItems, updateMenuItemPrice } from './menu.service';

export const menuRouter = Router();

menuRouter.post('/menu-items', requireHq, validateBody(createMenuItemSchema), async (request, response) => {
  const item = await createMenuItem(request.body.name, request.body.basePrice);
  response.status(201).json(item);
});

menuRouter.get('/menu-items', requireHq, async (_request, response) => {
  response.status(200).json(await listMenuItems());
});

menuRouter.post('/outlets/:outletId/menu-items', validateParams(outletIdParamSchema), requireOutletAccess, validateBody(assignMenuItemSchema), async (request, response) => {
  const { outletId } = request.params as { outletId: string };
  const assignment = await assignMenuItem(outletId, request.body.menuItemId);
  response.status(201).json(assignment);
});

menuRouter.put('/outlets/:outletId/menu-items/:menuItemId/price', validateParams(outletMenuItemParamsSchema), requireOutletAccess, validateBody(updateOutletMenuPriceSchema), async (request, response) => {
  const { outletId, menuItemId } = request.params as { outletId: string; menuItemId: string };
  const assignment = await updateMenuItemPrice(outletId, menuItemId, request.body.price);
  response.status(200).json(assignment);
});

menuRouter.get('/outlets/:outletId/menu', validateParams(outletIdParamSchema), requireOutletAccess, async (request, response) => {
  const { outletId } = request.params as { outletId: string };
  response.status(200).json(await getOutletMenu(outletId));
});
