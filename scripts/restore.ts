// scripts/restore.ts
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function restore(fileName?: string) {
  try {
    // Determine the file to restore
    let filePath: string;

    if (fileName) {
      // If a file name is provided
      if (fs.existsSync(fileName)) {
        filePath = fileName;
      } else if (fs.existsSync(path.join('backups', fileName))) {
        filePath = path.join('backups', fileName);
      } else {
        throw new Error(`File not found: ${fileName}`);
      }
    } else {
      // Default: use the latest backup
      filePath = path.join('backups', 'backup_latest.json');
      if (!fs.existsSync(filePath)) {
        throw new Error('No backup found. Run npm run backup first');
      }
    }

    console.log(`Restoring from ${filePath}...`);

    // Read the data
    const backup = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const data = backup.data || backup; // Support old and new format

    console.log(`Backup from ${backup.backupDate || 'unknown date'}`);
    if (backup.counts) {
      console.log(`   Contains:`, backup.counts);
    }

    // Temporarily disable foreign key constraints
    await prisma.$executeRaw`SET CONSTRAINTS ALL DEFERRED`;

    console.log('Cleaning the database...');

    // Clean the database in the correct order (reverse of dependencies)
    await prisma.auditLog.deleteMany();
    await prisma.shiftAssignment.deleteMany();
    await prisma.pikett.deleteMany();
    await prisma.shift.deleteMany();
    await prisma.user.deleteMany();
    await prisma.team.deleteMany();
    await prisma.rotationPattern.deleteMany();
    await prisma.outOfOfficeEvent.deleteMany();

    console.log('Database cleaned');
    console.log('Restoring data...');

    // Restore data in the correct order (respecting dependencies)

    // 1. Teams (no dependencies)
    if (data.teams && data.teams.length > 0) {
      console.log(`   - Restoring ${data.teams.length} teams...`);
      for (const team of data.teams) {
        const { lead, members, shifts, piketts, ...teamData } = team;
        await prisma.team.create({ data: teamData });
      }
    }

    // 2. Rotation Patterns (no dependencies)
    if (data.rotationPatterns && data.rotationPatterns.length > 0) {
      console.log(`   - Restoring ${data.rotationPatterns.length} rotation patterns...`);
      for (const pattern of data.rotationPatterns) {
        await prisma.rotationPattern.create({ data: pattern });
      }
    }

    // 3. Users (depends on Teams)
    if (data.users && data.users.length > 0) {
      console.log(`   - Restoring ${data.users.length} users...`);
      for (const user of data.users) {
        const { team, leadingTeam, assignments, piketts, azureId, ...userData } = user;
        // Remove azureId which no longer exists in the schema
        await prisma.user.create({ data: userData });
      }
    }

    // 4. Shifts (depends on Teams)
    if (data.shifts && data.shifts.length > 0) {
      console.log(`   - Restoring ${data.shifts.length} shifts...`);
      for (const shift of data.shifts) {
        const { team, assignments, ...shiftData } = shift;
        await prisma.shift.create({ data: shiftData });
      }
    }

    // 5. Piketts (depends on Teams and Users)
    if (data.piketts && data.piketts.length > 0) {
      console.log(`   - Restoring ${data.piketts.length} piketts...`);
      for (const pikett of data.piketts) {
        const { team, user, ...pikettData } = pikett;
        await prisma.pikett.create({ data: pikettData });
      }
    }

    // 6. Shift Assignments (depends on Shifts and Users)
    if (data.shiftAssignments && data.shiftAssignments.length > 0) {
      console.log(`   - Restoring ${data.shiftAssignments.length} assignments...`);
      for (const assignment of data.shiftAssignments) {
        const { shift, user, ...assignmentData } = assignment;
        // Convert date string to Date if needed
        const dataToInsert = {
          ...assignmentData,
          date: new Date(assignmentData.date),
          respondedAt: assignmentData.respondedAt ? new Date(assignmentData.respondedAt) : null
        };
        await prisma.shiftAssignment.create({ data: dataToInsert });
      }
    }

    // 7. Audit Logs (optional, no critical dependencies)
    if (data.auditLogs && data.auditLogs.length > 0) {
      console.log(`   - Restoring ${data.auditLogs.length} audit logs...`);
      for (const log of data.auditLogs) {
        await prisma.auditLog.create({
          data: {
            ...log,
            createdAt: new Date(log.createdAt)
          }
        });
      }
    }

    console.log('Restore completed successfully!');

    // Display final statistics
    const counts = await prisma.$transaction([
      prisma.team.count(),
      prisma.user.count(),
      prisma.shift.count(),
      prisma.pikett.count(),
      prisma.rotationPattern.count(),
      prisma.shiftAssignment.count(),
    ]);

    console.log('\nDatabase state:');
    console.log(`   - ${counts[0]} teams`);
    console.log(`   - ${counts[1]} users`);
    console.log(`   - ${counts[2]} shifts`);
    console.log(`   - ${counts[3]} piketts`);
    console.log(`   - ${counts[4]} rotation patterns`);
    console.log(`   - ${counts[5]} assignments`);

  } catch (error) {
    console.error('Error during restore:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line argument
const fileName = process.argv[2];

// Run the restore
restore(fileName)
  .then(() => {
    console.log('\nDatabase restored successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
