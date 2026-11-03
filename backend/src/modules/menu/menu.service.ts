import { Prisma } from '@prisma/client';
import { prisma } from '@/database/prisma';
import { AppError } from '@/http/errors';

const toNumber = (value: Prisma.Decimal): number => value.toNumber();

// `companyId` is undefined only for the NODE_ENV=test legacy-header adapter,
// which still exercises the unscoped catalog contract.
export async function createMenuItem(companyId: string | undefined, name: string, basePrice: number) {
  const item = await prisma.menuItem.create({
    data: { companyId, name, basePrice: new Prisma.Decimal(basePrice) }
  });
  return { ...item, basePrice: toNumber(item.basePrice) };
}

export async function listMenuItems(companyId: string | undefined) {
  const items = await prisma.menuItem.findMany({ where: companyId ? { companyId } : {}, orderBy: { name: 'asc' } });
  return { items: items.map((item) => ({ ...item, basePrice: toNumber(item.basePrice) })) };
}

async function findCatalogItem(companyId: string | undefined, menuItemId: string) {
  const item = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
  if (!item || (companyId && item.companyId !== companyId)) {
    throw new AppError(404, 'NOT_FOUND', 'Menu item was not found');
  }
  return item;
}

export async function updateMenuItem(companyId: string | undefined, menuItemId: string, changes: { name?: string; basePrice?: number }) {
  await findCatalogItem(companyId, menuItemId);
  const item = await prisma.menuItem.update({
    where: { id: menuItemId },
    data: { name: changes.name, ...(changes.basePrice !== undefined && { basePrice: new Prisma.Decimal(changes.basePrice) }) }
  });
  return { ...item, basePrice: toNumber(item.basePrice) };
}

export async function deleteMenuItem(companyId: string | undefined, menuItemId: string) {
  await findCatalogItem(companyId, menuItemId);
  // Sold items stay for receipt and report history; outlets must unassign the rest first.
  const [assignments, sales] = await Promise.all([
    prisma.outletMenuItem.count({ where: { menuItemId } }),
    prisma.saleItem.count({ where: { menuItemId } })
  ]);
  if (assignments || sales) {
    throw new AppError(409, 'MENU_ITEM_IN_USE', 'Menu item is assigned to outlets or has sales history');
  }
  await prisma.menuItem.delete({ where: { id: menuItemId } });
}

export async function unassignMenuItem(outletId: string, menuItemId: string) {
  const { count } = await prisma.outletMenuItem.deleteMany({ where: { outletId, menuItemId } });
  if (!count) throw new AppError(404, 'NOT_FOUND', 'Menu item assignment was not found');
}

export async function assignMenuItem(companyId: string | undefined, outletId: string, menuItemId: string) {
  const [outlet, menuItem] = await Promise.all([
    prisma.outlet.findUnique({ where: { id: outletId }, select: { id: true } }),
    prisma.menuItem.findUnique({ where: { id: menuItemId }, select: { companyId: true } })
  ]);

  // Another company's item is reported as missing so its existence does not leak.
  if (!outlet || !menuItem || (companyId && menuItem.companyId !== companyId)) {
    throw new AppError(404, 'NOT_FOUND', !outlet ? 'Outlet was not found' : 'Menu item was not found');
  }

  const assignment = await prisma.outletMenuItem.create({ data: { outletId, menuItemId } });
  return { ...assignment, priceOverride: assignment.priceOverride && toNumber(assignment.priceOverride) };
}

export async function updateMenuItemPrice(outletId: string, menuItemId: string, price: number) {
  try {
    const assignment = await prisma.outletMenuItem.update({
      where: { outletId_menuItemId: { outletId, menuItemId } },
      data: { priceOverride: new Prisma.Decimal(price) }
    });
    return { ...assignment, priceOverride: assignment.priceOverride && toNumber(assignment.priceOverride) };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new AppError(404, 'NOT_FOUND', 'Menu item assignment was not found');
    }
    throw error;
  }
}

export async function getOutletMenu(outletId: string) {
  const outlet = await prisma.outlet.findUnique({ where: { id: outletId }, select: { id: true } });
  if (!outlet) {
    throw new AppError(404, 'NOT_FOUND', 'Outlet was not found');
  }

  const assignments = await prisma.outletMenuItem.findMany({
    where: { outletId },
    include: { menuItem: true },
    orderBy: { assignedAt: 'asc' }
  });
  return {
    items: assignments.map(({ menuItem, priceOverride }) => ({
      id: menuItem.id,
      name: menuItem.name,
      price: toNumber(priceOverride ?? menuItem.basePrice)
    }))
  };
}
