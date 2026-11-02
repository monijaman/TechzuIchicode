import { describe, expect, it } from 'vitest';
import { rankTopSellingItems, sumRevenue } from '@/modules/reporting/domain/reporting.ts';

/**
 * Reporting calculations should be testable without a live database. Query
 * integration tests later verify that PostgreSQL returns the correct inputs.
 */
describe('reporting domain calculations', () => {
  it('sums revenue from completed sale totals', () => {
    expect(sumRevenue([250, 550, 100])).toBe(900);
  });

  it('returns zero revenue when there are no completed sales', () => {
    expect(sumRevenue([])).toBe(0);
  });

  it('preserves decimal currency totals', () => {
    expect(sumRevenue([10.25, 20.5, 0.25])).toBe(31);
  });

  it('ranks selling items by quantity in descending order', () => {
    expect(rankTopSellingItems([
      { menuItemId: 'a', quantity: 2 },
      { menuItemId: 'b', quantity: 7 },
      { menuItemId: 'c', quantity: 4 }
    ])).toEqual([
      { menuItemId: 'b', quantity: 7 },
      { menuItemId: 'c', quantity: 4 },
      { menuItemId: 'a', quantity: 2 }
    ]);
  });

  it('limits ranked items to the requested number', () => {
    expect(rankTopSellingItems([
      { menuItemId: 'a', quantity: 1 },
      { menuItemId: 'b', quantity: 2 },
      { menuItemId: 'c', quantity: 3 }
    ], 2)).toHaveLength(2);
  });

  it('aggregates repeated sales of the same menu item', () => {
    expect(rankTopSellingItems([
      { menuItemId: 'burger', quantity: 2 },
      { menuItemId: 'fries', quantity: 5 },
      { menuItemId: 'burger', quantity: 3 }
    ])).toEqual([
      { menuItemId: 'fries', quantity: 5 },
      { menuItemId: 'burger', quantity: 5 }
    ]);
  });

  it('uses deterministic ordering when item quantities are tied', () => {
    expect(rankTopSellingItems([
      { menuItemId: 'z-item', quantity: 5 },
      { menuItemId: 'a-item', quantity: 5 }
    ])).toEqual([
      { menuItemId: 'a-item', quantity: 5 },
      { menuItemId: 'z-item', quantity: 5 }
    ]);
  });

  it('rejects invalid ranking limits', () => {
    expect(() => rankTopSellingItems([], 0)).toThrow();
    expect(() => rankTopSellingItems([], -1)).toThrow();
    expect(() => rankTopSellingItems([], 1.5)).toThrow();
  });

  it('returns an empty ranking when there are no sales', () => {
    expect(rankTopSellingItems([])).toEqual([]);
  });
});
