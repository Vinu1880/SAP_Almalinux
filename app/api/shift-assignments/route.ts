// app/api/shift-assignments/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, createBulkShiftAssignmentsSchema } from '@/lib/validation';

// GET - Retrieve all shift assignments with filters
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.standard);
  if (rl) return rl;

  try {
    const { searchParams } = new URL(request.url);
    const dateFilter = searchParams.get('dateFilter'); // '24h', '7d', '30d', '90d', '180d'
    const teamId = searchParams.get('teamId');
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');

    // Calculate start date based on filter
    let startDate = new Date();
    if (dateFilter === '24h') {
      startDate.setHours(startDate.getHours() - 24);
    } else if (dateFilter === '7d') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (dateFilter === '30d') {
      startDate.setDate(startDate.getDate() - 30);
    } else if (dateFilter === '90d') {
      startDate.setDate(startDate.getDate() - 90);
    } else if (dateFilter === '180d') {
      startDate.setDate(startDate.getDate() - 180);
    }

    // Build filters
    const where: any = {};

    if (dateFilter) {
      where.createdAt = {
        gte: startDate
      };
    }

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    // Retrieve assignments with relations
    const assignments = await prisma.shiftAssignment.findMany({
      where,
      include: {
        user: {
          include: {
            team: true
          }
        },
        shift: {
          include: {
            team: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Filter by team if specified (after retrieval because team is in shift)
    let filteredAssignments = assignments;
    if (teamId) {
      filteredAssignments = assignments.filter(a => a.shift.teamId === teamId);
    }

    return NextResponse.json(filteredAssignments);
  } catch (error) {
    console.error('Error fetching shift assignments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shift assignments' },
      { status: 500 }
    );
  }
}

// POST - Create multiple shift assignments
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl2 = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl2) return rl2;

  try {
    const body = await request.json();
    const validation = validateBody(createBulkShiftAssignmentsSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { assignments } = validation.data;

    // Create all assignments using createMany
    const result = await prisma.shiftAssignment.createMany({
      data: assignments.map((a: any) => ({
        date: new Date(a.date),
        shiftId: a.shiftId,
        userId: a.userId,
        status: a.status || 'PENDING',
        reason: a.reason || null
      })),
      skipDuplicates: true // Avoid duplicates thanks to the unique constraint
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'CREATE_BULK',
        entity: 'SHIFT_ASSIGNMENT',
        userId: auth.user.id,
        data: { count: result.count, assignments }
      }
    });

    // Retrieve the created assignments to return them
    const createdAssignments = await prisma.shiftAssignment.findMany({
      where: {
        date: {
          in: assignments.map((a: any) => new Date(a.date))
        },
        shiftId: {
          in: assignments.map((a: any) => a.shiftId)
        }
      },
      include: {
        user: {
          include: {
            team: true
          }
        },
        shift: {
          include: {
            team: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      count: result.count,
      assignments: createdAssignments
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating shift assignments:', error);
    return NextResponse.json(
      {
        error: 'Failed to create shift assignments',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
