import { prisma } from '@/database/prisma';

/** Clears only the dedicated test database, preserving FK order. */
export async function resetTestDatabase(): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('resetTestDatabase can only run when NODE_ENV is test');
  }

  await prisma.$transaction([
    prisma.saleItem.deleteMany(),
    prisma.sale.deleteMany(),
    prisma.inventory.deleteMany(),
    prisma.receiptCounter.deleteMany(),
    prisma.outletMenuItem.deleteMany(),
    prisma.menuItem.deleteMany(),
    prisma.outlet.deleteMany(),
    prisma.company.deleteMany()
  ]);
}
