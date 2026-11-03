import { Prisma } from '@prisma/client';
import { prisma } from '@/database/prisma';
import { hashPassword } from '@/modules/auth/auth.service';

// Local demo credentials only; never seed these into a shared environment.
const demoPassword = 'demo-password-123';

async function main(): Promise<void> {
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.receiptCounter.deleteMany();
  await prisma.outletMenuItem.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.outlet.deleteMany();
  await prisma.company.deleteMany();

  const company = await prisma.company.create({
    data: {
      name: 'Demo Food Group',
      outlets: {
        create: [
          { name: 'Downtown Outlet', receiptCounter: { create: {} } },
          { name: 'Airport Outlet', receiptCounter: { create: {} } }
        ]
      },
      menuItems: { create: [{ name: 'Chicken Burger', basePrice: new Prisma.Decimal('250.00') }] }
    },
    include: { outlets: true, menuItems: true }
  });

  const [downtown] = company.outlets;
  const passwordHash = await hashPassword(demoPassword);
  await prisma.user.createMany({
    data: [
      { companyId: company.id, email: 'hq@demo.local', passwordHash, role: 'HQ' },
      { companyId: company.id, outletId: downtown.id, email: 'downtown@demo.local', passwordHash, role: 'OUTLET' }
    ]
  });
  const [burger] = company.menuItems;
  await prisma.outletMenuItem.create({
    data: {
      outletId: downtown.id,
      menuItemId: burger.id,
      inventory: { create: { quantity: 20 } }
    }
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
