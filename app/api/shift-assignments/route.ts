// app/api/shift-assignments/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { toJsonString } from '@/lib/json-helpers';

// GET - Récupérer toutes les assignations de shifts avec filtres
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const dateFilter = searchParams.get('dateFilter'); // '24h', '7d', '30d', '90d', '180d'
    const teamId = searchParams.get('teamId');
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');

    // Calculer la date de début basée sur le filtre
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

    // Construire les filtres
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

    // Récupérer les assignations avec les relations
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

    // Filtrer par équipe si spécifié (après récupération car team est dans shift)
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

// POST - Créer plusieurs assignations de shifts
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { assignments } = body; // Array d'objets {date, shiftId, userId, status}

    if (!assignments || !Array.isArray(assignments)) {
      return NextResponse.json(
        { error: 'Invalid assignments data' },
        { status: 400 }
      );
    }

    console.log('Creating shift assignments:', assignments.length);

    // Créer les assignations en utilisant upsert (skipDuplicates non supporté sur MSSQL)
    let createdCount = 0;
    for (const a of assignments) {
      try {
        await prisma.shiftAssignment.upsert({
          where: {
            date_shiftId_userId: {
              date: new Date(a.date),
              shiftId: a.shiftId,
              userId: a.userId
            }
          },
          update: {},
          create: {
            date: new Date(a.date),
            shiftId: a.shiftId,
            userId: a.userId,
            status: a.status || 'PENDING',
            reason: a.reason || null
          }
        });
        createdCount++;
      } catch (e: any) {
        if (e.code === 'P2002') continue;
        throw e;
      }
    }

    console.log(`Created ${createdCount} shift assignments`);

    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'CREATE_BULK',
        entity: 'SHIFT_ASSIGNMENT',
        data: toJsonString({ count: createdCount, assignments })
      }
    });

    // Récupérer les assignations créées pour les retourner
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
      count: createdCount,
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
