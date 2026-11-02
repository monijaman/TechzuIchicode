import { describe, expect, it } from 'vitest';
import {
  canDeductStock,
  deductStock,
  restockStock,
  validateRequestedQuantity,
  validateStockQuantity
} from '@/modules/inventory/domain/inventory.ts';

/**
 * Inventory rules must be deterministic and independent of HTTP or database
 * concerns. These tests define the safe stock behavior used by sales.
 */
describe('inventory domain rules', () => {
  it('allows a deduction when enough stock is available', () => {
    expect(canDeductStock({ available: 10, requested: 3 })).toBe(true);
  });

  it('rejects a deduction when stock is insufficient', () => {
    expect(canDeductStock({ available: 2, requested: 3 })).toBe(false);
  });

  it('returns the remaining stock after deduction', () => {
    expect(deductStock({ available: 10, requested: 3 })).toBe(7);
  });

  it('rejects a deduction that would create negative stock', () => {
    expect(() => deductStock({ available: 2, requested: 3 })).toThrow();
  });

  it('allows exact depletion of the available stock', () => {
    expect(canDeductStock({ available: 5, requested: 5 })).toBe(true);
    expect(deductStock({ available: 5, requested: 5 })).toBe(0);
  });

  it('rejects a deduction from an empty inventory', () => {
    expect(canDeductStock({ available: 0, requested: 1 })).toBe(false);
    expect(() => deductStock({ available: 0, requested: 1 })).toThrow();
  });

  it('rejects zero and negative requested quantities', () => {
    expect(() => validateRequestedQuantity(0)).toThrow();
    expect(() => validateRequestedQuantity(-1)).toThrow();
  });

  it('rejects fractional stock and requested quantities', () => {
    expect(() => validateStockQuantity(-1)).toThrow();
    expect(() => validateStockQuantity(1.5)).toThrow();
    expect(() => validateRequestedQuantity(1.5)).toThrow();
  });

  it('supports large whole-number quantities', () => {
    expect(validateStockQuantity(1_000_000)).toBe(1_000_000);
    expect(deductStock({ available: 1_000_000, requested: 999_999 })).toBe(1);
  });

  it('supports repeated deductions without producing negative stock', () => {
    const afterFirstSale = deductStock({ available: 10, requested: 3 });
    const afterSecondSale = deductStock({ available: afterFirstSale, requested: 7 });
    expect(afterSecondSale).toBe(0);
  });

  it('adds stock when an outlet is restocked', () => {
    expect(restockStock({ available: 4, quantity: 6 })).toBe(10);
  });

  it('rejects invalid restock quantities', () => {
    expect(() => restockStock({ available: 4, quantity: 0 })).toThrow();
    expect(() => restockStock({ available: 4, quantity: -2 })).toThrow();
    expect(() => restockStock({ available: 4, quantity: 1.5 })).toThrow();
  });
});
