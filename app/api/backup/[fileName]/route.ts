// app/api/backup/[fileName]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { safePath } from '@/lib/pathSecurity';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import fs from 'fs';
import path from 'path';

// DELETE - Delete a specific backup file
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.backup);
  if (rl) return rl;

  try {
    const { fileName } = await params;
    const backupsDir = path.join(process.cwd(), 'backups');

    const filePath = safePath(backupsDir, fileName);
    if (!filePath) {
      return NextResponse.json(
        { error: 'Invalid file name' },
        { status: 400 }
      );
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    fs.unlinkSync(filePath);

    const checksumPath = filePath + '.sha256';
    if (fs.existsSync(checksumPath)) {
      fs.unlinkSync(checksumPath);
    }

    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        entity: 'BACKUP',
        entityId: fileName,
        userId: auth.user.id,
        data: { fileName }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Backup deleted'
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Error during deletion' },
      { status: 500 }
    );
  }
}
