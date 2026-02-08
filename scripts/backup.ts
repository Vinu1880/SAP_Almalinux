// scripts/backup.ts
import { PrismaClient } from '../generated/prisma/index.js';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function backup() {
  console.log('📦 Création de la sauvegarde...');
  
  // Créer le dossier backups s'il n'existe pas
  const backupsDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir);
  }
  
  const data = {
    teams: await prisma.team.findMany(),
    users: await prisma.user.findMany(),
    shifts: await prisma.shift.findMany(),
    piketts: await prisma.pikett.findMany(),
    rotationPatterns: await prisma.rotationPattern.findMany(),
    shiftAssignments: await prisma.shiftAssignment.findMany(),
    outOfOfficeEvents: await prisma.outOfOfficeEvent.findMany(),
    auditLogs: await prisma.auditLog.findMany(),
  };
  
  const fileName = `backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
  const filePath = path.join(backupsDir, fileName);
  
  const backup = {
    version: '1.0.0',
    backupDate: new Date().toISOString(),
    counts: {
      teams: data.teams.length,
      users: data.users.length,
      shifts: data.shifts.length,
      piketts: data.piketts.length,
      rotationPatterns: data.rotationPatterns.length,
      shiftAssignments: data.shiftAssignments.length,
      outOfOfficeEvents: data.outOfOfficeEvents.length,
      auditLogs: data.auditLogs.length,
    },
    data
  };
  
  fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));
  
  // Créer aussi un backup "latest"
  const latestPath = path.join(backupsDir, 'backup_latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(backup, null, 2));
  
  console.log(`✅ Sauvegarde créée: ${fileName}`);
  console.log(`   - ${data.teams.length} équipes`);
  console.log(`   - ${data.users.length} utilisateurs`);
  console.log(`   - ${data.shifts.length} shifts`);
  console.log(`   - ${data.piketts.length} piketts`);
  console.log(`   - ${data.rotationPatterns.length} patterns de rotation`);
  console.log(`   - ${data.shiftAssignments.length} assignations`);
}

backup()
  .catch(console.error)
  .finally(() => prisma.$disconnect());