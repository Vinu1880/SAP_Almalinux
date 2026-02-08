// restore-now.mjs
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function restore() {
  try {
    console.log('📥 Restauration depuis backup_2025-09-24.json...');
    
    const backup = JSON.parse(fs.readFileSync('backup_2025-09-24.json', 'utf-8'));
    const data = backup.data || backup;
    
    console.log('🗑️ Nettoyage de la base...');
    
    // Nettoyer dans l'ordre
    await prisma.shiftAssignment.deleteMany();
    await prisma.pikett.deleteMany();
    await prisma.shift.deleteMany();
    await prisma.user.deleteMany();
    await prisma.team.deleteMany();
    await prisma.rotationPattern.deleteMany();
    
    console.log('📝 Restauration des données...');
    
    // Teams
    if (data.teams?.length > 0) {
      console.log(`Restauration de ${data.teams.length} équipes...`);
      for (const team of data.teams) {
        await prisma.team.create({
          data: {
            id: team.id,
            name: team.name,
            description: team.description,
            color: team.color,
            createdAt: new Date(team.createdAt),
            updatedAt: new Date(team.updatedAt)
          }
        });
      }
    }
    
    // Users
    if (data.users?.length > 0) {
      console.log(`Restauration de ${data.users.length} utilisateurs...`);
      for (const user of data.users) {
        await prisma.user.create({
          data: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            role: user.role,
            workPercent: user.workPercent,
            status: user.status,
            notes: user.notes,
            teamId: user.teamId,
            rotationConfig: user.rotationConfig,
            availability: user.availability,
            createdAt: new Date(user.createdAt),
            updatedAt: new Date(user.updatedAt)
          }
        });
      }
    }
    
    // Shifts
    if (data.shifts?.length > 0) {
      console.log(`Restauration de ${data.shifts.length} shifts...`);
      for (const shift of data.shifts) {
        await prisma.shift.create({
          data: {
            id: shift.id,
            name: shift.name,
            description: shift.description,
            startTime: shift.startTime,
            endTime: shift.endTime,
            daysOfWeek: shift.daysOfWeek,
            membersRequired: shift.membersRequired,
            priority: shift.priority,
            status: shift.status,
            color: shift.color,
            includedUserIds: shift.includedUserIds,
            excludedUserIds: shift.excludedUserIds,
            teamId: shift.teamId,
            createdAt: new Date(shift.createdAt),
            updatedAt: new Date(shift.updatedAt)
          }
        });
      }
    }
    
    // Rotation Patterns
    if (data.rotationPatterns?.length > 0) {
      console.log(`Restauration de ${data.rotationPatterns.length} patterns...`);
      for (const pattern of data.rotationPatterns) {
        await prisma.rotationPattern.create({
          data: {
            id: pattern.id,
            name: pattern.name,
            description: pattern.description,
            cycleLength: pattern.cycleLength,
            weeks: pattern.weeks,
            createdAt: new Date(pattern.createdAt),
            updatedAt: new Date(pattern.updatedAt)
          }
        });
      }
    }
    
    console.log('✅ Restauration terminée avec succès!');
    
    const counts = await prisma.$transaction([
      prisma.team.count(),
      prisma.user.count(),
      prisma.shift.count(),
      prisma.rotationPattern.count()
    ]);
    
    console.log(`\n📊 Base restaurée:`);
    console.log(`   - ${counts[0]} équipes`);
    console.log(`   - ${counts[1]} utilisateurs`);
    console.log(`   - ${counts[2]} shifts`);
    console.log(`   - ${counts[3]} patterns`);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restore();