// app/api/teams/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, updateTeamSchema } from '@/lib/validation';

// GET - Retrieve a team by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.standard);
  if (rl) return rl;

  try {
    const { id } = await params;

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        lead: true,
        members: true,
        shifts: true,
        _count: {
          select: {
            members: true,
            shifts: true
          }
        }
      }
    });

    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(team);
  } catch (error) {
    console.error('Error fetching team:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team' },
      { status: 500 }
    );
  }
}

// PUT - Update a team
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const { id } = await params;
    const body = await request.json();

    const validation = validateBody(updateTeamSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Prepare update data
    const updateData: any = {};

    if (validation.data.name !== undefined) updateData.name = validation.data.name;
    if (validation.data.description !== undefined) updateData.description = validation.data.description || null;
    if (validation.data.color !== undefined) updateData.color = validation.data.color;

    // Handle leadId separately - IMPORTANT to fix the lead assignment bug
    if (validation.data.leadId !== undefined) {
      if (validation.data.leadId === 'none' || validation.data.leadId === '' || validation.data.leadId === null) {
        updateData.leadId = null;
      } else {
        // Verify that the user exists
        const userExists = await prisma.user.findUnique({
          where: { id: validation.data.leadId }
        });

        if (userExists) {
          updateData.leadId = validation.data.leadId;
        } else {
          console.warn(`User with id ${validation.data.leadId} not found, updating team without lead`);
          updateData.leadId = null;
        }
      }
    }

    // Handle team members if provided
    if (validation.data.memberIds !== undefined && Array.isArray(validation.data.memberIds)) {
      // Get current members
      const currentMembers = await prisma.user.findMany({
        where: { teamId: id },
        select: { id: true }
      });
      const currentMemberIds = currentMembers.map(m => m.id);

      // Determine users to remove from the team
      const membersToRemove = currentMemberIds.filter(
        memberId => !validation.data.memberIds!.includes(memberId)
      );

      // Determine users to add to the team
      const membersToAdd = validation.data.memberIds!.filter(
        (memberId: string) => !currentMemberIds.includes(memberId)
      );

      // Remove users from the team (set teamId to null)
      if (membersToRemove.length > 0) {
        await prisma.user.updateMany({
          where: {
            id: { in: membersToRemove }
          },
          data: {
            teamId: null
          }
        });
      }

      // Add new users to the team
      if (membersToAdd.length > 0) {
        await prisma.user.updateMany({
          where: {
            id: { in: membersToAdd }
          },
          data: {
            teamId: id
          }
        });
      }
    }

    const team = await prisma.team.update({
      where: { id },
      data: updateData,
      include: {
        lead: true,
        members: true,
        _count: {
          select: { members: true }
        }
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'TEAM',
        entityId: team.id,
        userId: auth.user.id,
        data: { before: body, after: team }
      }
    });

    return NextResponse.json(team);
  } catch (error) {
    console.error('Error updating team:', error);
    return NextResponse.json(
      { error: 'Failed to update team', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a team
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const { id } = await params;

    // Check if there are members in the team
    const membersCount = await prisma.user.count({
      where: { teamId: id }
    });

    if (membersCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete team with members. Please reassign members first.' },
        { status: 400 }
      );
    }

    // Check if there are associated shifts
    const shiftsCount = await prisma.shift.count({
      where: { teamId: id }
    });

    if (shiftsCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete team with shifts. Please delete or reassign shifts first.' },
        { status: 400 }
      );
    }

    // Delete the team
    const team = await prisma.team.delete({
      where: { id }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        entity: 'TEAM',
        entityId: id,
        userId: auth.user.id,
        data: team
      }
    });

    return NextResponse.json({ success: true, deleted: team });
  } catch (error) {
    console.error('Error deleting team:', error);
    return NextResponse.json(
      { error: 'Failed to delete team', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
