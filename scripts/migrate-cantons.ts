import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

async function migrateCantons() {
  const cantonMapping: { [key: string]: string } = {
    'lausanne': 'VD', 'yverdon': 'VD', 'yverdon-les-bains': 'VD',
    'bern': 'BE', 'berne': 'BE',
    'zurich': 'ZH', 'winterthur': 'ZH'
  };
  
  const users = await prisma.user.findMany();
  
  for (const user of users) {
    if (user.location) {
      const normalized = user.location.toLowerCase();
      const canton = cantonMapping[normalized] || 'BE'; // BE par défaut
      
      await prisma.user.update({
        where: { id: user.id },
        data: { location: canton }
      });
      
      console.log(`Migré ${user.firstName} ${user.lastName}: ${user.location} -> ${canton}`);
    }
  }
  
  console.log('Migration terminée!');
}

migrateCantons()
  .catch(console.error)
  .finally(() => prisma.$disconnect());