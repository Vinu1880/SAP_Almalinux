// app/api/teams/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, createTeamSchema } from '@/lib/validation';

// GET - Retrieve all teams
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.standard);
  if (rl) return rl;

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

  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const body = await request.json();

    const validation = validateBody(createTeamSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Prepare data excluding leadId if it is empty, null or 'none'
    const teamData: any = {
      name: validation.data.name,
      description: validation.data.description || null,
      color: validation.data.color || '#3b82f6'
    };

    // Only add leadId if it exists and is not 'none'
    if (validation.data.leadId && validation.data.leadId !== 'none' && validation.data.leadId !== '') {
      // Verify that the user exists
      const userExists = await prisma.user.findUnique({
        where: { id: validation.data.leadId }
      });

      if (userExists) {
        teamData.leadId = validation.data.leadId;
      } else {
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
        userId: auth.user.id,
        data: team
      }
    });

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create team' },
      { status: 500 }
    );
  }
}
