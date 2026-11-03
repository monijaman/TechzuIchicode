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
