// scripts/backup.ts
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import fs from 'fs';
import path from 'path';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function backup() {
  console.log('Creating backup...');

  // Create the backups directory if it does not exist
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

  const backupData = {
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

  fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));

  // Also create a "latest" backup
  const latestPath = path.join(backupsDir, 'backup_latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(backupData, null, 2));

  console.log(`Backup created: ${fileName}`);
  console.log(`   - ${data.teams.length} teams`);
  console.log(`   - ${data.users.length} users`);
  console.log(`   - ${data.shifts.length} shifts`);
  console.log(`   - ${data.piketts.length} piketts`);
  console.log(`   - ${data.rotationPatterns.length} rotation patterns`);
  console.log(`   - ${data.shiftAssignments.length} assignments`);
}

backup()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
