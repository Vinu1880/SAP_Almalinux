import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, createBulkShiftAssignmentsSchema } from '@/lib/validation';
import { resolveLocalUserId } from '@/lib/resolveUser';

// Retrieve shift assignments with filters
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

    const assignments = await prisma.shiftAssignment.findMany({
      where,
      include: {
        user: { include: { team: true } },
        shift: { include: { team: true } },
        sentBy: { select: { id: true, firstName: true, lastName: true, email: true } }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Team filter is post-query — team lives inside shift
    let filteredAssignments = assignments;
    if (teamId) {
      filteredAssignments = assignments.filter(a => a.shift.teamId === teamId);
    }

    return NextResponse.json(filteredAssignments);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch shift assignments' },
      { status: 500 }
    );
  }
}

// Bulk create shift assignments
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
    const sentById = await resolveLocalUserId(auth.user);

    const result = await prisma.shiftAssignment.createMany({
      data: assignments.map((a: any) => ({
        date: new Date(a.date),
        shiftId: a.shiftId,
        userId: a.userId,
        status: a.status || 'PENDING',
        reason: a.reason || null,
        sentById,
        segmentStart: a.segmentStart ?? null,
        segmentEnd: a.segmentEnd ?? null,
        segmentGroupId: a.segmentGroupId ?? null,
        segmentIndex: a.segmentIndex ?? null
      })),
      skipDuplicates: true
    });

    await prisma.auditLog.create({
      data: {
        action: 'CREATE_BULK',
        entity: 'SHIFT_ASSIGNMENT',
        userId: auth.user.id,
        data: { count: result.count, assignments }
      }
    });

    const createdAssignments = await prisma.shiftAssignment.findMany({
      where: {
        date: { in: assignments.map((a: any) => new Date(a.date)) },
        shiftId: { in: assignments.map((a: any) => a.shiftId) },
        userId: { in: assignments.map((a: any) => a.userId) },
      },
      include: {
        user: { include: { team: true } },
        shift: { include: { team: true } },
        sentBy: { select: { id: true, firstName: true, lastName: true, email: true } }
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
        error: 'Failed to create shift assignments'
      },
      { status: 500 }
    );
  }
}
