// app/api/audit-logs/cleanup/route.ts
// Delete audit logs older than 90 days
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { logSecurityEvent } from '@/lib/securityLogger';

const RETENTION_DAYS = 90;

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const result = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } }
    });

    logSecurityEvent({
      type: 'AUDIT_LOGS_CLEANUP',
      userEmail: auth.user.mail,
      details: `deleted=${result.count}, retention=${RETENTION_DAYS}d`,
    });

    return NextResponse.json({
      deleted: result.count,
      retentionDays: RETENTION_DAYS,
      cutoffDate: cutoff.toISOString(),
    });
  } catch (error) {
    console.error('[DELETE /api/audit-logs/cleanup] Error:', error);
    return NextResponse.json({ error: 'Failed to cleanup audit logs' }, { status: 500 });
  }
}
