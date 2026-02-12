// app/api/shifts/route.ts

import { NextRequest, NextResponse } from 'next/server';
import  prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET - Retrieve all shifts
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

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
    console.error('Error fetching shifts:', error);
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

  try {
    const body = await request.json();

    const shift = await prisma.shift.create({
      data: {
        name: body.name,
        description: body.description || null,
        startTime: body.startTime,
        endTime: body.endTime,
        teamId: body.teamId,
        membersRequired: body.membersRequired || 1,
        priority: body.priority || 'MEDIUM',
        status: body.status || 'ACTIVE',
        color: body.color || '#3b82f6',
        senderMailbox: body.senderMailbox,
        includedUserIds: body.includedUserIds || [],
        excludedUserIds: body.excludedUserIds || []
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
        data: shift as any
      }
    });

    return NextResponse.json(shift, { status: 201 });
  } catch (error) {
    console.error('Error creating shift:', error);
    return NextResponse.json(
      { error: 'Failed to create shift', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
