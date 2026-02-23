// app/api/shifts/route.ts

import { NextRequest, NextResponse } from 'next/server';
import  prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, createShiftSchema } from '@/lib/validation';

// GET - Retrieve all shifts
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.standard);
  if (rl) return rl;

  try {
    const shifts = await prisma.shift.findMany({
      include: {
        team: true,
        _count: {
          select: {
            assignments: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json(shifts);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch shifts' },
      { status: 500 }
    );
  }
}

// POST - Create a new shift
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const body = await request.json();

    const validation = validateBody(createShiftSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const shift = await prisma.shift.create({
      data: {
        name: validation.data.name,
        description: validation.data.description || null,
        startTime: validation.data.startTime,
        endTime: validation.data.endTime,
        teamId: validation.data.teamId,
        membersRequired: validation.data.membersRequired || 1,
        priority: validation.data.priority || 'MEDIUM',
        status: validation.data.status || 'ACTIVE',
        color: validation.data.color || '#3b82f6',
        senderMailbox: validation.data.senderMailbox,
        includedUserIds: validation.data.includedUserIds || [],
        excludedUserIds: validation.data.excludedUserIds || []
      },
      include: {
        team: true
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'SHIFT',
        entityId: shift.id,
        userId: auth.user.id,
        data: shift as any
      }
    });

    return NextResponse.json(shift, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create shift' },
      { status: 500 }
    );
  }
}
