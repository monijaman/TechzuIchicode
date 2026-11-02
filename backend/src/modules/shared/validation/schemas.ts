import { z } from 'zod';

export const createMenuItemSchema = z.object({
  name: z.string().trim().min(1),
  basePrice: z.number().finite().positive()
});

export const createSaleSchema = z.object({
  items: z.array(z.object({
    menuItemId: z.string().trim().min(1),
    quantity: z.number().int().positive()
  })).min(1)
});

export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
