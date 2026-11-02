import { describe, expect, it } from 'vitest';
import { nextReceiptNumber } from '@/modules/sales/domain/receipt';

/**
 * Receipt numbers are sequential within an outlet. The domain rule is tested
 * separately from database locking, which is covered by integration tests.
 */
describe('receipt numbering rules', () => {
  it('starts an outlet sequence at one', () => {
    expect(nextReceiptNumber(null)).toBe(1);
  });

  it('increments the previous outlet receipt number', () => {
    expect(nextReceiptNumber(41)).toBe(42);
  });

  it('keeps numbering continuous after a large sequence value', () => {
    expect(nextReceiptNumber(999_999)).toBe(1_000_000);
  });

  it('returns an integer receipt number', () => {
    expect(Number.isInteger(nextReceiptNumber(10))).toBe(true);
  });

  it('rejects invalid previous receipt values', () => {
    expect(() => nextReceiptNumber(0)).toThrow();
    expect(() => nextReceiptNumber(-1)).toThrow();
    expect(() => nextReceiptNumber(1.5)).toThrow();
    expect(() => nextReceiptNumber(Number.NaN)).toThrow();
    expect(() => nextReceiptNumber(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => nextReceiptNumber('10' as unknown as number)).toThrow();
  });

  it('rejects values beyond the safe integer range', () => {
    expect(() => nextReceiptNumber(Number.MAX_SAFE_INTEGER)).toThrow();
  });
});
