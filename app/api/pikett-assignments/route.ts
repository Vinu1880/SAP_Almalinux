// app/api/pikett-assignments/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, createBulkPikettAssignmentsSchema } from '@/lib/validation';

// GET - Retrieve pikett assignments with filters
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.standard);
  if (rl) return rl;

  try {
    const { searchParams } = new URL(request.url);
    const dateFilter = searchParams.get('dateFilter');
    const teamId = searchParams.get('teamId');
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const rangeStart = searchParams.get('startDate');
    const rangeEnd = searchParams.get('endDate');

    let filterStartDate = new Date();
    if (dateFilter === '24h') {
      filterStartDate.setHours(filterStartDate.getHours() - 24);
    } else if (dateFilter === '7d') {
      filterStartDate.setDate(filterStartDate.getDate() - 7);
    } else if (dateFilter === '30d') {
      filterStartDate.setDate(filterStartDate.getDate() - 30);
    } else if (dateFilter === '90d') {
      filterStartDate.setDate(filterStartDate.getDate() - 90);
    } else if (dateFilter === '180d') {
      filterStartDate.setDate(filterStartDate.getDate() - 180);
    }

    const where: any = {};

    if (rangeStart && rangeEnd) {
      where.date = {
        gte: new Date(rangeStart),
        lte: new Date(rangeEnd)
      };
    } else if (dateFilter) {
      where.createdAt = {
        gte: filterStartDate
      };
    }

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    const assignments = await prisma.pikettAssignment.findMany({
      where,
      include: {
        user: {
          include: {
            team: true
          }
        },
        pikett: {
          include: {
            team: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Team filter applied post-query since team is nested in pikett
    let filteredAssignments = assignments;
    if (teamId) {
      filteredAssignments = assignments.filter(a => a.pikett.teamId === teamId);
    }

    return NextResponse.json(filteredAssignments);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch pikett assignments' },
      { status: 500 }
    );
  }
}

// POST - Bulk create pikett assignments
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl2 = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl2) return rl2;

  try {
    const body = await request.json();
    const validation = validateBody(createBulkPikettAssignmentsSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { assignments } = validation.data;

    const result = await prisma.pikettAssignment.createMany({
      data: assignments.map((a: any) => ({
        date: new Date(a.date),
        pikettId: a.pikettId,
        userId: a.userId,
        status: a.status || 'PENDING',
        reason: a.reason || null
      })),
      skipDuplicates: true
    });

    await prisma.auditLog.create({
      data: {
        action: 'CREATE_BULK',
        entity: 'PIKETT_ASSIGNMENT',
        userId: auth.user.id,
        data: { count: result.count, assignments }
      }
    });

    const createdAssignments = await prisma.pikettAssignment.findMany({
      where: {
        date: {
          in: assignments.map((a: any) => new Date(a.date))
        },
        pikettId: {
          in: assignments.map((a: any) => a.pikettId)
        }
      },
      include: {
        user: {
          include: {
            team: true
          }
        },
        pikett: {
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
    return NextResponse.json(
      {
        error: 'Failed to create pikett assignments'
      },
      { status: 500 }
    );
  }
}
