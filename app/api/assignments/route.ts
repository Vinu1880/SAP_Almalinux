// app/api/assignments/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { toJsonString, fromJsonString } from '@/lib/json-helpers';

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
      // Parse cantons from string if needed (MSSQL stores as String)
      const holidayCantons: string[] = fromJsonString(holiday.cantons) || [];

      // Check if holiday applies to all cantons
      if (holidayCantons.includes('ALL')) {
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
      if (holidayCantons.includes(userCanton)) {
        return {
          valid: false,
          reason: `Non-working day in ${userCanton}`,
          holidayName: holiday.name
        };
      }
    }

    return { valid: true };
  } catch (error) {
    console.error('Error validating holiday:', error);
    // In case of error, allow assignment but log the error
    return { valid: true };
  }
}

// POST - Créer des assignations de shifts (bulk)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { shiftId, assignments } = body;
    
    // Vérifier que le shift existe
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

    // Créer les assignations en bulk (only if all validations passed)
    const createdAssignments = await Promise.all(
      assignments.map(async (assignment: any) => {
        try {
          // Vérifier si l'assignation existe déjà
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
            // Mettre à jour si elle existe
            return await prisma.shiftAssignment.update({
              where: { id: existing.id },
              data: {
                status: assignment.status || 'PENDING',
                reason: assignment.reason
              }
            });
          }

          // Créer une nouvelle assignation
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
          console.error('Error creating assignment:', error);
          return null;
        }
      })
    );
    
    // Filtrer les assignations nulles (erreurs)
    const successfulAssignments = createdAssignments.filter(a => a !== null);
    
    // Mettre à jour le compteur d'utilisation du shift
    await prisma.shift.update({
      where: { id: shiftId },
      data: {
        usageCount: { increment: successfulAssignments.length },
        lastUsedAt: new Date()
      }
    });
    
    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'ASSIGNMENT',
        entityId: shiftId,
        data: toJsonString({ count: successfulAssignments.length })
      }
    });
    
    return NextResponse.json({
      success: true,
      created: successfulAssignments.length,
      assignments: successfulAssignments
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error creating assignments:', error);
    return NextResponse.json(
      { error: 'Failed to create assignments' },
      { status: 500 }
    );
  }
}

// GET - Récupérer les assignations
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

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

    // Parse string fields in included shift data
    const normalizedAssignments = assignments.map(a => ({
      ...a,
      shift: {
        ...a.shift,
        daysOfWeek: fromJsonString(a.shift.daysOfWeek),
        includedUserIds: fromJsonString(a.shift.includedUserIds),
        excludedUserIds: fromJsonString(a.shift.excludedUserIds),
      }
    }));

    return NextResponse.json(normalizedAssignments);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assignments' },
      { status: 500 }
    );
  }
}