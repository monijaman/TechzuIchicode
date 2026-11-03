import { z } from 'zod';

export const createMenuItemSchema = z.object({
  name: z.string().trim().min(1),
  basePrice: z.number().finite().positive()
});

export const createCompanySchema = z.object({
  name: z.string().trim().min(1)
});

export const createOutletSchema = z.object({
  name: z.string().trim().min(1)
});

export const assignMenuItemSchema = z.object({
  menuItemId: z.string().uuid()
});

export const updateOutletMenuPriceSchema = z.object({
  price: z.number().finite().positive()
});

export const companyIdParamSchema = z.object({
  companyId: z.string().uuid()
});

export const outletIdParamSchema = z.object({
  outletId: z.string().uuid()
});

export const outletMenuItemParamsSchema = z.object({
  outletId: z.string().uuid(),
  menuItemId: z.string().uuid()
});

export const updateInventorySchema = z.object({
  quantity: z.number().int().nonnegative()
});

export const createInventorySchema = updateInventorySchema.extend({
  menuItemId: z.string().uuid()
});

export const createSaleSchema = z.object({
  items: z.array(z.object({
    menuItemId: z.string().trim().min(1),
    quantity: z.number().int().positive()
  })).min(1)
});

const reportDateSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'Must be an ISO-compatible date or timestamp'
});

export const revenueReportQuerySchema = z.object({
  from: reportDateSchema.optional(),
  to: reportDateSchema.optional()
}).superRefine(({ from, to }, context) => {
  if (from && to && Date.parse(from) > Date.parse(to)) {
    context.addIssue({ code: 'custom', message: '`to` must not precede `from`', path: ['to'] });
  }
});

export const topItemsReportQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(5)
});

export const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(12).max(128),
  companyName: z.string().trim().min(1).max(200)
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128)
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1)
});

export const createUserSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(12).max(128),
  role: z.enum(['HQ', 'OUTLET']),
  outletId: z.string().uuid().optional()
}).superRefine((value, context) => {
  if (value.role === 'OUTLET' && !value.outletId) context.addIssue({ code: 'custom', path: ['outletId'], message: 'Outlet users require an outlet' });
  if (value.role === 'HQ' && value.outletId) context.addIssue({ code: 'custom', path: ['outletId'], message: 'HQ users cannot be limited to an outlet' });
});

export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
