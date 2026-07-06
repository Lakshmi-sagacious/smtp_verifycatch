// Re-export the generated Prisma client + all enums/types so callers import from
// one workspace package instead of reaching into node_modules/.prisma.
export * from '@prisma/client';
export { PrismaClient } from '@prisma/client';
