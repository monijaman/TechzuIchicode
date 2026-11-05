import { prisma } from '@/database/prisma';
import { AppError } from '@/http/errors';

export async function createCompany(name: string) {
  return prisma.company.create({ data: { name } });
}

export async function createOutlet(companyId: string, name: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) {
    throw new AppError(404, 'NOT_FOUND', 'Company was not found');
  }

  return prisma.outlet.create({ data: { companyId, name, receiptCounter: { create: {} } } });
}

export async function listOutlets(companyId: string) {
  return prisma.outlet.findMany({ where: { companyId }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
}

export async function listCompanyUsers(companyId: string) {
  return prisma.user.findMany({
    where: { companyId },
    select: {
      id: true,
      email: true,
      role: true,
      outletId: true,
      isActive: true,
      createdAt: true,
      outlet: { select: { name: true } }
    },
    orderBy: [{ role: 'asc' }, { email: 'asc' }]
  });
}

export async function updateCompanyUserOutlet(companyId: string, userId: string, outletId: string) {
  const [user, outlet] = await Promise.all([
    prisma.user.findFirst({ where: { id: userId, companyId }, select: { id: true, role: true } }),
    prisma.outlet.findFirst({ where: { id: outletId, companyId }, select: { id: true } })
  ]);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User was not found for this company');
  if (user.role !== 'OUTLET') throw new AppError(400, 'INVALID_USER_ROLE', 'Only outlet users can be assigned to an outlet');
  if (!outlet) throw new AppError(404, 'NOT_FOUND', 'Outlet was not found for this company');

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { outletId },
    select: { id: true, outletId: true, outlet: { select: { name: true } } }
  });
  return updatedUser;
}
