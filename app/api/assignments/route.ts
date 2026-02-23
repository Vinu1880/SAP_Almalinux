// app/api/assignments/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, createAssignmentsSchema } from '@/lib/validation';

// Helper function to map location to canton code
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

// Helper function to validate assignment against holidays
async function validateAssignmentAgainstHolidays(
  userId: string,
  date: Date
): Promise<{ valid: boolean; reason?: string; holidayName?: string }> {
  try {
    // Fetch user with location
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { location: true, firstName: true, lastName: true }
    });

    if (!user) {
      return { valid: false, reason: 'User not found' };
    }

    // Fetch holidays for this specific date
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

    // Get user's canton
    const userCanton = getUserCantonFromLocation(user.location || '');

    // Check if any holiday applies to this user
    for (const holiday of holidays) {
      // Check if holiday applies to all cantons
      if (holiday.cantons.includes('ALL')) {
        return {
          valid: false,
          reason: `Non-working day in all cantons`,
          holidayName: holiday.name
        };
      }

      // If user has no location, only federal holidays apply
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

      // Check if user's canton matches holiday canton
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
    // In case of error, allow assignment
    return { valid: true };
  }
}

// POST - Create shift assignments (bulk)
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

    // Verify that the shift exists
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId }
    });

    if (!shift) {
      return NextResponse.json(
        { error: 'Shift not found' },
        { status: 404 }
      );
    }

    // Validate all assignments against holidays first
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

    // Check for any validation failures
    const failures = validationResults.filter(r => !r.validation.valid);
    if (failures.length > 0) {
      // Get user details for error message
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

    // Create assignments in bulk (only if all validations passed)
    const createdAssignments = await Promise.all(
      assignments.map(async (assignment: any) => {
        try {
          // Check if the assignment already exists
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
            // Update if it exists
            return await prisma.shiftAssignment.update({
              where: { id: existing.id },
              data: {
                status: assignment.status || 'PENDING',
                reason: assignment.reason
              }
            });
          }

          // Create a new assignment
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

    // Filter out null assignments (errors)
    const successfulAssignments = createdAssignments.filter(a => a !== null);

    // Update the shift usage counter
    await prisma.shift.update({
      where: { id: shiftId },
      data: {
        usageCount: { increment: successfulAssignments.length },
        lastUsedAt: new Date()
      }
    });

    // Audit log
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

// GET - Retrieve assignments
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
