// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

// Global declaration to avoid multiple instances in development
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Create a single PrismaClient instance
const prisma = global.prisma || new PrismaClient();

// In development, save the instance globally to avoid reconnections
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Named export AND default export for maximum compatibility
export { prisma };
export default prisma;
