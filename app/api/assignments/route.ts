// app/api/assignments/route.ts
// Legacy assignment creation with holiday validation per canton

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, createAssignmentsSchema } from '@/lib/validation';

function getUserCantonFromLocation(location: string): string {
  if (!location || typeof location !== 'string') {
    return 'BE';
  }

  const upperLocation = location.toUpperCase();
  if (['VD', 'BE', 'ZH'].includes(upperLocation)) {
    return upperLocation;
  }

  return 'BE';
}

// Checks if a user's canton has a holiday on the given date
async function validateAssignmentAgainstHolidays(
  userId: string,
  date: Date
): Promise<{ valid: boolean; reason?: string; holidayName?: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { location: true, firstName: true, lastName: true }
    });

    if (!user) {
      return { valid: false, reason: 'User not found' };
    }

    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: dateStart,
          lte: dateEnd
        }
      }
    });

    if (holidays.length === 0) {
      return { valid: true };
    }

    const userCanton = getUserCantonFromLocation(user.location || '');

    for (const holiday of holidays) {
      if (holiday.cantons.includes('ALL')) {
        return {
          valid: false,
          reason: `Non-working day in all cantons`,
          holidayName: holiday.name
        };
      }

      if (!user.location || user.location === '') {
        if (holiday.type === 'FEDERAL') {
          return {
            valid: false,
            reason: `Federal holiday`,
            holidayName: holiday.name
          };
        }
        continue;
      }

      if (holiday.cantons.includes(userCanton)) {
        return {
          valid: false,
          reason: `Non-working day in ${userCanton}`,
          holidayName: holiday.name
        };
      }
    }

    return { valid: true };
  } catch (error) {
    return { valid: true };
  }
}

// POST - Create assignments with holiday validation, upserts on conflict
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const body = await request.json();
    const validation = validateBody(createAssignmentsSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { shiftId, assignments } = validation.data;

    const shift = await prisma.shift.findUnique({
      where: { id: shiftId }
    });

    if (!shift) {
      return NextResponse.json(
        { error: 'Shift not found' },
        { status: 404 }
      );
    }

    const validationResults = await Promise.all(
      assignments.map(async (assignment: any) => {
        const validation = await validateAssignmentAgainstHolidays(
          assignment.userId,
          new Date(assignment.date)
        );
        return {
          assignment,
          validation
        };
      })
    );

    const failures = validationResults.filter(r => !r.validation.valid);
    if (failures.length > 0) {
      const failureDetails = await Promise.all(
        failures.map(async f => {
          const user = await prisma.user.findUnique({
            where: { id: f.assignment.userId },
            select: { firstName: true, lastName: true, location: true }
          });
          return {
            user: user ? `${user.firstName} ${user.lastName}` : 'Unknown user',
            location: user?.location || 'No location',
            date: new Date(f.assignment.date).toISOString().split('T')[0],
            reason: f.validation.reason,
            holiday: f.validation.holidayName
          };
        })
      );

      return NextResponse.json(
        {
          error: 'Some assignments conflict with holidays',
          details: failureDetails,
          message: failureDetails.map(d =>
            `${d.user} cannot work on ${d.date}: ${d.holiday} (${d.reason})`
          ).join('; ')
        },
        { status: 400 }
      );
    }

    const createdAssignments = await Promise.all(
      assignments.map(async (assignment: any) => {
        try {
          const existing = await prisma.shiftAssignment.findUnique({
            where: {
              date_shiftId_userId: {
                date: new Date(assignment.date),
                shiftId: shiftId,
                userId: assignment.userId
              }
            }
          });

          if (existing) {
            return await prisma.shiftAssignment.update({
              where: { id: existing.id },
              data: {
                status: assignment.status || 'PENDING',
                reason: assignment.reason
              }
            });
          }

          return await prisma.shiftAssignment.create({
            data: {
              date: new Date(assignment.date),
              shiftId: shiftId,
              userId: assignment.userId,
              status: assignment.status || 'PENDING',
              reason: assignment.reason
            }
          });
        } catch (error) {
          return null;
        }
      })
    );

    const successfulAssignments = createdAssignments.filter(a => a !== null);

    await prisma.shift.update({
      where: { id: shiftId },
      data: {
        usageCount: { increment: successfulAssignments.length },
        lastUsedAt: new Date()
      }
    });

    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'ASSIGNMENT',
        entityId: shiftId,
        userId: auth.user.id,
        data: { count: successfulAssignments.length }
      }
    });

    return NextResponse.json({
      success: true,
      created: successfulAssignments.length,
      assignments: successfulAssignments
    }, { status: 201 });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create assignments' },
      { status: 500 }
    );
  }
}

// GET - Retrieve assignments with optional filters
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl2 = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.standard);
  if (rl2) return rl2;

  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const shiftId = searchParams.get('shiftId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');

    const where: any = {};

    if (userId) where.userId = userId;
    if (shiftId) where.shiftId = shiftId;
    if (status) where.status = status;

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const assignments = await prisma.shiftAssignment.findMany({
      where,
      include: {
        shift: {
          include: {
            team: true
          }
        },
        user: true
      },
      orderBy: {
        date: 'asc'
      }
    });

    return NextResponse.json(assignments);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch assignments' },
      { status: 500 }
    );
  }
}
