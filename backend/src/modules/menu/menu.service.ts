import { Prisma } from '@prisma/client';
import { prisma } from '@/database/prisma';
import { AppError } from '@/http/errors';

const toNumber = (value: Prisma.Decimal): number => value.toNumber();

export async function createMenuItem(name: string, basePrice: number) {
  const item = await prisma.menuItem.create({
    data: { name, basePrice: new Prisma.Decimal(basePrice) }
  });
  return { ...item, basePrice: toNumber(item.basePrice) };
}

export async function listMenuItems() {
  const items = await prisma.menuItem.findMany({ orderBy: { name: 'asc' } });
  return { items: items.map((item) => ({ ...item, basePrice: toNumber(item.basePrice) })) };
}

export async function assignMenuItem(outletId: string, menuItemId: string) {
  const [outlet, menuItem] = await Promise.all([
    prisma.outlet.findUnique({ where: { id: outletId }, select: { id: true } }),
    prisma.menuItem.findUnique({ where: { id: menuItemId }, select: { id: true } })
  ]);

  if (!outlet || !menuItem) {
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
