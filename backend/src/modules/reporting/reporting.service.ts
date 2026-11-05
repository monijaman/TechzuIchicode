import { Prisma } from '@prisma/client';
import { prisma } from '@/database/prisma';
import { AppError } from '@/http/errors';

type DateRange = { from?: string; to?: string };
type CompanyReportFilter = DateRange & { outletId?: string };

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

type CompanyReportRow = {
  outletId: string;
  outletName: string;
  totalRevenue: Prisma.Decimal;
  menuItemId: string | null;
  itemName: string | null;
  quantity: bigint | number | null;
};

export async function getCompanySalesReport(companyId: string, filter: CompanyReportFilter) {
  const startsAt = filter.from ? new Date(filter.from) : undefined;
  const endsAt = filter.to ? new Date(filter.to) : undefined;
  if (filter.to && /^\d{4}-\d{2}-\d{2}$/.test(filter.to)) {
    endsAt!.setUTCHours(23, 59, 59, 999);
  }

  const outletFilter = filter.outletId
    ? Prisma.sql`AND o."id" = ${filter.outletId}::uuid`
    : Prisma.empty;
  const revenueFromFilter = startsAt
    ? Prisma.sql`AND s."soldAt" >= ${startsAt}`
    : Prisma.empty;
  const revenueToFilter = endsAt
    ? Prisma.sql`AND s."soldAt" <= ${endsAt}`
    : Prisma.empty;
  const itemsFromFilter = startsAt
    ? Prisma.sql`AND s."soldAt" >= ${startsAt}`
    : Prisma.empty;
  const itemsToFilter = endsAt
    ? Prisma.sql`AND s."soldAt" <= ${endsAt}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<CompanyReportRow[]>(Prisma.sql`
    WITH selected_outlets AS (
      SELECT o."id", o."name"
      FROM "Outlet" o
      WHERE o."companyId" = ${companyId}::uuid ${outletFilter}
    ),
    revenue AS (
      SELECT s."outletId", SUM(s."totalAmount") AS "totalRevenue"
      FROM "Sale" s
      INNER JOIN selected_outlets o ON o."id" = s."outletId"
      WHERE TRUE ${revenueFromFilter} ${revenueToFilter}
      GROUP BY s."outletId"
    ),
    item_totals AS (
      SELECT s."outletId", si."menuItemId", COALESCE(mi."name", 'Deleted menu item') AS "itemName",
        SUM(si."quantity") AS "quantity"
      FROM "Sale" s
      INNER JOIN selected_outlets o ON o."id" = s."outletId"
      INNER JOIN "SaleItem" si ON si."saleId" = s."id"
      LEFT JOIN "MenuItem" mi ON mi."id" = si."menuItemId"
      WHERE TRUE ${itemsFromFilter} ${itemsToFilter}
      GROUP BY s."outletId", si."menuItemId", mi."name"
    ),
    ranked_items AS (
      SELECT "outletId", "menuItemId", "itemName", "quantity",
        ROW_NUMBER() OVER (PARTITION BY "outletId" ORDER BY "quantity" DESC, "menuItemId" ASC) AS "rank"
      FROM item_totals
    )
    SELECT o."id" AS "outletId", o."name" AS "outletName",
      COALESCE(r."totalRevenue", 0) AS "totalRevenue",
      i."menuItemId", i."itemName", i."quantity"
    FROM selected_outlets o
    LEFT JOIN revenue r ON r."outletId" = o."id"
    LEFT JOIN ranked_items i ON i."outletId" = o."id" AND i."rank" <= 5
    ORDER BY o."name" ASC, i."rank" ASC
  `);

  const outlets = new Map<string, {
    outletId: string;
    outletName: string;
    totalRevenue: number;
    topItems: Array<{ menuItemId: string; name: string; quantity: number }>;
  }>();

  for (const row of rows) {
    let report = outlets.get(row.outletId);
    if (!report) {
      report = {
        outletId: row.outletId,
        outletName: row.outletName,
        totalRevenue: row.totalRevenue.toNumber(),
        topItems: []
      };
      outlets.set(row.outletId, report);
    }
    if (row.menuItemId && row.itemName !== null && row.quantity !== null) {
      report.topItems.push({
        menuItemId: row.menuItemId,
        name: row.itemName,
        quantity: Number(row.quantity)
      });
    }
  }

  return {
    outlets: [...outlets.values()],
    ...(filter.outletId && { outletId: filter.outletId }),
    ...(filter.from && { from: filter.from }),
    ...(filter.to && { to: filter.to })
  };
}
