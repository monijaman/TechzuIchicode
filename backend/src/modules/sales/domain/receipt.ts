export function nextReceiptNumber(previous: number | null): number {
  if (previous === null) return 1;

  if (!Number.isSafeInteger(previous) || previous <= 0 || previous >= Number.MAX_SAFE_INTEGER) {
    throw new Error('Previous receipt number must be a safe positive integer');
  }

  return previous + 1;
}
