// lib/prisma.ts
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Global declaration to avoid multiple instances in development
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  // PrismaPg uses the native pg driver which treats sslmode=prefer as verify-full,
  // causing failures when PostgreSQL has no SSL certificate (e.g. Docker containers).
  // Remove sslmode=prefer to let pg use its default (no SSL for local connections).
  let connectionString = process.env.DATABASE_URL || '';
  connectionString = connectionString.replace(/[?&]sslmode=prefer/g, (match) =>
    match.startsWith('?') ? '?' : ''
  );
  // Clean up trailing ? or && after removal
  connectionString = connectionString.replace(/\?&/, '?').replace(/\?$/, '');

  const adapter = new PrismaPg({ connectionString });
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
