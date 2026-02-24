// lib/prisma.ts
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Global declaration to avoid multiple instances in development
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// Create a single PrismaClient instance
const prisma = global.prisma || createPrismaClient();

// In development, save the instance globally to avoid reconnections
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Named export AND default export for maximum compatibility
export { prisma };
export default prisma;
