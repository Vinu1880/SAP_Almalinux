// app/api/teams/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET - Récupérer une équipe par ID
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

// PUT - Mettre à jour une équipe
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    // Préparer les données de mise à jour
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description || null;
    if (body.color !== undefined) updateData.color = body.color;

    // Gérer leadId séparément - IMPORTANT pour corriger le bug du responsable
    if (body.leadId !== undefined) {
      if (body.leadId === 'none' || body.leadId === '' || body.leadId === null) {
        updateData.leadId = null;
      } else {
        // Vérifier que l'utilisateur existe
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

    // Gérer les membres de l'équipe si fournis
    if (body.memberIds !== undefined && Array.isArray(body.memberIds)) {
      // Récupérer les membres actuels
      const currentMembers = await prisma.user.findMany({
        where: { teamId: id },
        select: { id: true }
      });
      const currentMemberIds = currentMembers.map(m => m.id);

      // Déterminer les utilisateurs à retirer de l'équipe
      const membersToRemove = currentMemberIds.filter(
        memberId => !body.memberIds.includes(memberId)
      );

      // Déterminer les utilisateurs à ajouter à l'équipe
      const membersToAdd = body.memberIds.filter(
        (memberId: string) => !currentMemberIds.includes(memberId)
      );

      // Retirer les utilisateurs de l'équipe (mettre teamId à null)
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

      // Ajouter les nouveaux utilisateurs à l'équipe
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

    // Log audit
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

// DELETE - Supprimer une équipe
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    // Vérifier s'il y a des membres dans l'équipe
    const membersCount = await prisma.user.count({
      where: { teamId: id }
    });
    
    if (membersCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete team with members. Please reassign members first.' },
        { status: 400 }
      );
    }
    
    // Vérifier s'il y a des shifts associés
    const shiftsCount = await prisma.shift.count({
      where: { teamId: id }
    });
    
    if (shiftsCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete team with shifts. Please delete or reassign shifts first.' },
        { status: 400 }
      );
    }
    
    // Supprimer l'équipe
    const team = await prisma.team.delete({
      where: { id }
    });
    
    // Log audit
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