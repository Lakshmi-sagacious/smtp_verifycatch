import { PrismaClient } from '@smtp/db';

export const prisma: PrismaClient = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
