import { prisma } from '@/database/prisma';
import { AppError } from '@/http/errors';

export async function requireOutlet(outletId: string): Promise<void> {
  const outlet = await prisma.outlet.findUnique({ where: { id: outletId }, select: { id: true } });
  if (!outlet) {
    throw new AppError(404, 'NOT_FOUND', 'Outlet was not found');
  }
}

async function requireAssignment(outletId: string, menuItemId: string): Promise<void> {
  const assignment = await prisma.outletMenuItem.findUnique({
    where: { outletId_menuItemId: { outletId, menuItemId } },
    select: { outletId: true }
  });
  if (assignment) return;

  await requireOutlet(outletId);
  throw new AppError(404, 'NOT_FOUND', 'Menu item is not assigned to this outlet');
}

export async function setInventory(outletId: string, menuItemId: string, quantity: number) {
  await requireAssignment(outletId, menuItemId);
  return prisma.inventory.upsert({
    where: { outletId_menuItemId: { outletId, menuItemId } },
    create: { outletId, menuItemId, quantity },
    update: { quantity }
  });
}

export async function createInventory(outletId: string, menuItemId: string, quantity: number) {
  await requireAssignment(outletId, menuItemId);
  return prisma.inventory.create({ data: { outletId, menuItemId, quantity } });
}

export async function getInventory(outletId: string) {
  await requireOutlet(outletId);

  const inventory = await prisma.inventory.findMany({
    where: { outletId },
    include: { outletItem: { include: { menuItem: true } } },
    orderBy: { outletItem: { assignedAt: 'asc' } }
  });
  return {
    items: inventory.map(({ menuItemId, quantity, outletItem }) => ({
      menuItemId,
      name: outletItem.menuItem.name,
      quantity
    }))
  };
}
