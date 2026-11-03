import { prisma } from '@/database/prisma';
import { AppError } from '@/http/errors';

type DateRange = { from?: string; to?: string };

function rangeFilter({ from, to }: DateRange) {
  if (!from && !to) return undefined;

  const startsAt = from ? new Date(from) : undefined;
  const endsAt = to ? new Date(to) : undefined;
  // A date-only end value represents the whole calendar day, inclusive.
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    endsAt!.setUTCHours(23, 59, 59, 999);
  }
  return { ...(startsAt && { gte: startsAt }), ...(endsAt && { lte: endsAt }) };
}

async function requireOutlet(outletId: string): Promise<void> {
  const outlet = await prisma.outlet.findUnique({ where: { id: outletId }, select: { id: true } });
  if (!outlet) throw new AppError(404, 'NOT_FOUND', 'Outlet was not found');
}

export async function getRevenueReport(outletId: string, range: DateRange) {
  await requireOutlet(outletId);
  const total = await prisma.sale.aggregate({
    where: { outletId, ...(rangeFilter(range) && { soldAt: rangeFilter(range) }) },
    _sum: { totalAmount: true }
  });

  return {
    totalRevenue: total._sum.totalAmount?.toNumber() ?? 0,
    ...(range.from && { from: range.from }),
    ...(range.to && { to: range.to })
  };
}

export async function getTopItemsReport(outletId: string, limit: number) {
  await requireOutlet(outletId);
  const groupedItems = await prisma.saleItem.groupBy({
    by: ['menuItemId'],
    where: { sale: { outletId } },
    _sum: { quantity: true },
    orderBy: [{ _sum: { quantity: 'desc' } }, { menuItemId: 'asc' }],
    take: limit
  });
  const itemsById = new Map((await prisma.menuItem.findMany({
    where: { id: { in: groupedItems.map((item) => item.menuItemId) } },
    select: { id: true, name: true }
  })).map((item) => [item.id, item]));

  return {
    items: groupedItems.map((item) => ({
      menuItemId: item.menuItemId,
      name: itemsById.get(item.menuItemId)?.name ?? 'Deleted menu item',
      quantity: item._sum.quantity ?? 0
    }))
  };
}
