// app/api/teams/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET - Retrieve all teams
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const teams = await prisma.team.findMany({
      include: {
        lead: true,
        _count: {
          select: {
            members: true,
            shifts: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teams' },
      { status: 500 }
    );
  }
}

// POST - Create a new team
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    // Prepare data excluding leadId if it is empty, null or 'none'
    const teamData: any = {
      name: body.name,
      description: body.description || null,
      color: body.color || '#3b82f6'
    };

    // Only add leadId if it exists and is not 'none'
    if (body.leadId && body.leadId !== 'none' && body.leadId !== '') {
      // Verify that the user exists
      const userExists = await prisma.user.findUnique({
        where: { id: body.leadId }
      });

      if (userExists) {
        teamData.leadId = body.leadId;
      } else {
        console.warn(`User with id ${body.leadId} not found, creating team without lead`);
      }
    }

    const team = await prisma.team.create({
      data: teamData,
      include: {
        lead: true,
        _count: {
          select: { members: true }
        }
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'TEAM',
        entityId: team.id,
        data: team
      }
    });

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    console.error('Error creating team:', error);
    return NextResponse.json(
      { error: 'Failed to create team', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
