import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { prisma } from '@/database/prisma';
import { AppError } from '@/http/errors';
import type { CreateSaleInput } from '@/modules/shared/validation/schemas';

type SaleRequestLine = CreateSaleInput['items'][number];
type CreateSaleOptions = { idempotencyKey?: string; idempotencyFingerprint?: string };

function combineLines(items: SaleRequestLine[]): SaleRequestLine[] {
  const quantities = new Map<string, number>();
  for (const item of items) {
    quantities.set(item.menuItemId, (quantities.get(item.menuItemId) ?? 0) + item.quantity);
  }
  return [...quantities.entries()]
    .map(([menuItemId, quantity]) => ({ menuItemId, quantity }))
    .sort((left, right) => left.menuItemId.localeCompare(right.menuItemId));
}

function serializeSale(sale: {
  id: string;
  receiptNumber: number;
  totalAmount: Prisma.Decimal;
  items: Array<{ id: string; menuItemId: string; quantity: number; unitPrice: Prisma.Decimal; lineTotal: Prisma.Decimal }>;
}) {
  return {
    id: sale.id,
    receiptNumber: sale.receiptNumber,
    totalAmount: sale.totalAmount.toNumber(),
    items: sale.items.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toNumber(),
      lineTotal: item.lineTotal.toNumber()
    }))
  };
}

function idempotencyConflict(): AppError {
  return new AppError(409, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency key was already used with a different sale');
}

export function fingerprintSale(input: CreateSaleInput): string {
  return createHash('sha256')
    .update(JSON.stringify({ items: combineLines(input.items) }))
    .digest('hex');
}

export async function createSale(outletId: string, input: CreateSaleInput, options: CreateSaleOptions = {}) {
  const requestedItems = combineLines(input.items);

  const create = () => prisma.$transaction(async (transaction) => {
    if (options.idempotencyKey) {
      const existing = await transaction.sale.findUnique({
        where: { outletId_idempotencyKey: { outletId, idempotencyKey: options.idempotencyKey } },
        include: { items: { orderBy: { id: 'asc' } } }
      });
      if (existing) {
        if (existing.idempotencyFingerprint !== options.idempotencyFingerprint) throw idempotencyConflict();
        return { sale: serializeSale(existing), replayed: true };
      }
    }

    const outlet = await transaction.outlet.findUnique({ where: { id: outletId }, select: { id: true } });
    if (!outlet) {
      throw new AppError(404, 'NOT_FOUND', 'Outlet was not found');
    }

    const menuItemIds = requestedItems.map((item) => item.menuItemId);
    const menuItems = await transaction.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true }
    });
    if (menuItems.length !== menuItemIds.length) {
      throw new AppError(404, 'NOT_FOUND', 'Menu item was not found');
    }

    const assignments = await transaction.outletMenuItem.findMany({
      where: { outletId, menuItemId: { in: menuItemIds } },
      include: { menuItem: { select: { basePrice: true } } }
    });
    if (assignments.length !== menuItemIds.length) {
      throw new AppError(409, 'MENU_ITEM_NOT_ASSIGNED', 'A menu item is not assigned to this outlet');
    }

    // This row-level update serializes receipt allocation per outlet. Any later
    // error rolls it back with the stock and sale writes below.
    const receiptCounter = await transaction.receiptCounter.update({
      where: { outletId },
      data: { lastIssued: { increment: 1 } },
      select: { lastIssued: true }
    });

    const assignmentsByItem = new Map(assignments.map((assignment) => [assignment.menuItemId, assignment]));
    const saleItems = [];
    let totalAmount = new Prisma.Decimal(0);

    for (const item of requestedItems) {
      const stockChange = await transaction.inventory.updateMany({
        where: { outletId, menuItemId: item.menuItemId, quantity: { gte: item.quantity } },
        data: { quantity: { decrement: item.quantity } }
      });
      if (stockChange.count !== 1) {
        throw new AppError(409, 'INSUFFICIENT_STOCK', 'Insufficient inventory for this sale');
      }

      const assignment = assignmentsByItem.get(item.menuItemId)!;
      const unitPrice = assignment.priceOverride ?? assignment.menuItem.basePrice;
      const lineTotal = unitPrice.mul(item.quantity);
      totalAmount = totalAmount.add(lineTotal);
      saleItems.push({ menuItemId: item.menuItemId, quantity: item.quantity, unitPrice, lineTotal });
    }

    const sale = await transaction.sale.create({
      data: {
        outletId,
        receiptNumber: receiptCounter.lastIssued,
        totalAmount,
        idempotencyKey: options.idempotencyKey,
        idempotencyFingerprint: options.idempotencyFingerprint,
        items: { create: saleItems }
      },
      include: { items: { orderBy: { id: 'asc' } } }
    });

    return { sale: serializeSale(sale), replayed: false };
  });

  try {
    return await create();
  } catch (error) {
    // A concurrent retry can both observe no existing sale. The unique key
    // makes one transaction win; return that winner to the loser if identical.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002' || !options.idempotencyKey) {
      throw error;
    }
    const existing = await prisma.sale.findUnique({
      where: { outletId_idempotencyKey: { outletId, idempotencyKey: options.idempotencyKey } },
      include: { items: { orderBy: { id: 'asc' } } }
    });
    if (!existing || existing.idempotencyFingerprint !== options.idempotencyFingerprint) throw idempotencyConflict();
    return { sale: serializeSale(existing), replayed: true };
  }
}
