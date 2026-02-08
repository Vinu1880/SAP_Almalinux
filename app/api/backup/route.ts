// app/api/backup/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    console.log('📦 Création de la sauvegarde...');
    
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
    
    // Vérifier les rotations des utilisateurs
    console.log('🔄 Vérification des rotations utilisateurs:');
    const usersWithRotation = data.users.filter(u => u.rotationConfig !== null);
    console.log(`  - ${usersWithRotation.length} utilisateur(s) avec rotation configurée`);
    usersWithRotation.forEach(u => {
      console.log(`    • ${u.firstName} ${u.lastName}: ${JSON.stringify(u.rotationConfig)}`);
    });
    
    const backupsDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir);
    }
    
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
        usersWithRotation: usersWithRotation.length
      },
      data
    };
    
    fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));
    
    const latestPath = path.join(backupsDir, 'backup_latest.json');
    fs.writeFileSync(latestPath, JSON.stringify(backup, null, 2));
    
    return NextResponse.json({ 
      success: true, 
      fileName,
      counts: backup.counts,
      details: {
        usersWithRotation: usersWithRotation.length,
        activeShifts: data.shifts.filter(s => s.status === 'ACTIVE').length,
        activePiketts: data.piketts.filter(p => p.status === 'ACTIVE').length,
        totalAssignments: data.shiftAssignments.length
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de la sauvegarde' },
      { status: 500 }
    );
  }
}