// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

// Déclaration globale pour éviter les instances multiples en développement
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Créer une instance unique de PrismaClient
const prisma = global.prisma || new PrismaClient();

// En développement, sauvegarder l'instance globalement pour éviter les reconnexions
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Export nommé ET export par défaut pour compatibilité maximale
export { prisma };
export default prisma;