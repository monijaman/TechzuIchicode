export type SoldItem = { menuItemId: string; quantity: number };

export function sumRevenue(amounts: number[]): number {
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  return Math.round(total * 100) / 100;
}

export function rankTopSellingItems(items: SoldItem[], limit = 5): SoldItem[] {
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new Error('Ranking limit must be a positive whole number');
  }

  const totals = new Map<string, number>();
  for (const item of items) {
    if (!item.menuItemId || !Number.isSafeInteger(item.quantity) || item.quantity < 0) {
      throw new Error('Invalid sold item');
    }
    totals.set(item.menuItemId, (totals.get(item.menuItemId) ?? 0) + item.quantity);
  }

  return [...totals.entries()]
    .map(([menuItemId, quantity]) => ({ menuItemId, quantity }))
    .sort((a, b) => b.quantity - a.quantity || a.menuItemId.localeCompare(b.menuItemId))
    .slice(0, limit);
}
