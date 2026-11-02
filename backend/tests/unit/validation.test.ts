import { describe, expect, it } from 'vitest';
import { createMenuItemSchema, createSaleSchema } from '@/modules/shared/validation/schemas.ts';

/**
 * Validation should reject malformed input before business services or the
 * database are called. These tests define the boundary of accepted payloads.
 */
describe('request validation schemas', () => {
  it('accepts a valid menu item payload', () => {
    expect(createMenuItemSchema.parse({ name: 'Burger', basePrice: 250 })).toEqual({
      name: 'Burger',
      basePrice: 250
    });
  });

  it('rejects an empty menu item name', () => {
    expect(() => createMenuItemSchema.parse({ name: '', basePrice: 250 })).toThrow();
  });

  it('rejects a whitespace-only menu item name', () => {
    expect(() => createMenuItemSchema.parse({ name: '   ', basePrice: 250 })).toThrow();
  });

  it('rejects a missing menu item price', () => {
    expect(() => createMenuItemSchema.parse({ name: 'Burger' })).toThrow();
  });

  it('rejects a non-positive menu item price', () => {
    expect(() => createMenuItemSchema.parse({ name: 'Burger', basePrice: 0 })).toThrow();
  });

  it('rejects a price supplied as a string', () => {
    expect(() => createMenuItemSchema.parse({ name: 'Burger', basePrice: '250' })).toThrow();
  });

  it('accepts a sale with positive whole-number quantities', () => {
    expect(createSaleSchema.parse({ items: [{ menuItemId: 'item-1', quantity: 2 }] })).toBeTruthy();
  });

  it('rejects an empty sale', () => {
    expect(() => createSaleSchema.parse({ items: [] })).toThrow();
  });

  it('rejects a sale without an items field', () => {
    expect(() => createSaleSchema.parse({})).toThrow();
  });

  it('rejects a sale item without a menu item ID', () => {
    expect(() => createSaleSchema.parse({ items: [{ quantity: 1 }] })).toThrow();
  });

  it('rejects an empty menu item ID', () => {
    expect(() => createSaleSchema.parse({ items: [{ menuItemId: '', quantity: 1 }] })).toThrow();
  });

  it('rejects fractional sale quantities', () => {
    expect(() => createSaleSchema.parse({ items: [{ menuItemId: 'item-1', quantity: 1.5 }] })).toThrow();
  });

  it('rejects a quantity supplied as a string', () => {
    expect(() => createSaleSchema.parse({ items: [{ menuItemId: 'item-1', quantity: '2' }] })).toThrow();
  });
});
