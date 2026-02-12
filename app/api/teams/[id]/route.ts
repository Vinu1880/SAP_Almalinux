// app/api/teams/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET - Retrieve a team by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

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

  try {
    const { id } = await params;
    const body = await request.json();

    // Prepare update data
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description || null;
    if (body.color !== undefined) updateData.color = body.color;

    // Handle leadId separately - IMPORTANT to fix the lead assignment bug
    if (body.leadId !== undefined) {
      if (body.leadId === 'none' || body.leadId === '' || body.leadId === null) {
        updateData.leadId = null;
      } else {
        // Verify that the user exists
        const userExists = await prisma.user.findUnique({
          where: { id: body.leadId }
        });

        if (userExists) {
          updateData.leadId = body.leadId;
        } else {
          console.warn(`User with id ${body.leadId} not found, updating team without lead`);
          updateData.leadId = null;
        }
      }
    }

    // Handle team members if provided
    if (body.memberIds !== undefined && Array.isArray(body.memberIds)) {
      // Get current members
      const currentMembers = await prisma.user.findMany({
        where: { teamId: id },
        select: { id: true }
      });
      const currentMemberIds = currentMembers.map(m => m.id);

      // Determine users to remove from the team
      const membersToRemove = currentMemberIds.filter(
        memberId => !body.memberIds.includes(memberId)
      );

      // Determine users to add to the team
      const membersToAdd = body.memberIds.filter(
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
