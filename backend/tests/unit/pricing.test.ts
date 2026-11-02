import { describe, expect, it } from 'vitest';
import {
  calculateLineTotal,
  calculateSaleTotal,
  resolveUnitPrice,
  validatePrice,
  validateQuantity
} from '@/modules/sales/domain/pricing.ts';

/**
 * These tests protect the pricing rules used when a master menu item is sold
 * by a specific outlet. An outlet price override takes priority over the HQ
 * price, while invalid prices must be rejected before a sale is created.
 */
describe('outlet price rules', () => {
  it('uses the outlet override price when one exists', () => {
    // HQ defines the base price, but an outlet may sell the same item at a different price.
    expect(resolveUnitPrice({ basePrice: 250, overridePrice: 275 })).toBe(275);
  });

  it('falls back to the master price when no override exists', () => {
    // A missing override must never result in a missing or zero sale price.
    expect(resolveUnitPrice({ basePrice: 250, overridePrice: null })).toBe(250);
  });

  it('rejects zero and negative prices', () => {
    // Prices must be positive because free or negative-priced menu items are invalid here.
    expect(() => validatePrice(0)).toThrow();
    expect(() => validatePrice(-1)).toThrow();
  });

  it('accepts positive prices', () => {
    expect(validatePrice(250)).toBe(250);
  });
});

/**
 * These tests verify the arithmetic used by sales. Totals must be calculated
 * consistently from quantities and prices, including decimal currency values.
 */
describe('sale totals', () => {
  it('calculates each line total from quantity and unit price', () => {
    // A line total is the amount contributed by one menu item to the sale.
    expect(calculateLineTotal({ unitPrice: 275, quantity: 2 })).toBe(550);
  });

  it('calculates the total from persisted sale lines', () => {
    // The sale total must be the sum of all persisted line totals.
    expect(calculateSaleTotal([
      { unitPrice: 250, quantity: 2 },
      { unitPrice: 100, quantity: 1 }
    ])).toBe(600);
  });

  it('avoids floating-point rounding errors for decimal prices', () => {
    // Currency calculations must remain accurate for prices containing decimal values.
    expect(calculateLineTotal({ unitPrice: 10.25, quantity: 3 })).toBe(30.75);
  });

  it('rejects zero and negative quantities', () => {
    // A sale must contain at least one unit and must never increase stock through a negative quantity.
    expect(() => validateQuantity(0)).toThrow();
    expect(() => validateQuantity(-1)).toThrow();
  });

  it('accepts positive integer quantities', () => {
    expect(validateQuantity(3)).toBe(3);
  });

  it('rejects fractional quantities', () => {
    // Menu items are sold in whole units in this system.
    expect(() => validateQuantity(1.5)).toThrow();
  });
});
