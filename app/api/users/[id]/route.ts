// app/api/users/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { toJsonString, fromJsonString } from '@/lib/json-helpers';

// GET - Récupérer un utilisateur spécifique
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        team: true,
        leadingTeam: true
      }
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Normaliser les champs JSON
    let normalizedRotationConfig = user.rotationConfig;
    if (typeof user.rotationConfig === 'string') {
      try {
        normalizedRotationConfig = JSON.parse(user.rotationConfig);
        console.log(`⚠️ Parsing rotationConfig string for ${user.firstName}`);
      } catch (e) {
        console.error(`❌ Failed to parse rotationConfig for ${user.firstName}:`, e);
        normalizedRotationConfig = null;
      }
    }

    let normalizedAvailability = user.availability;
    if (typeof user.availability === 'string') {
      try {
        normalizedAvailability = JSON.parse(user.availability);
      } catch (e) {
        console.error(`❌ Failed to parse availability for ${user.firstName}:`, e);
        normalizedAvailability = null;
      }
    }

    console.log(`GET User ${user.firstName} ${user.lastName}:`, {
      rotationConfig: normalizedRotationConfig,
      type: typeof normalizedRotationConfig
    });

    const normalizedUser = {
      ...user,
      rotationConfig: normalizedRotationConfig,
      availability: normalizedAvailability
    };

    return NextResponse.json(normalizedUser);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

// PUT - Mettre à jour un utilisateur
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    console.log('=== UPDATING USER ===');
    console.log('User ID:', id);
    console.log('Request body:', JSON.stringify(body, null, 2));
    
    // Préparer les données de mise à jour
    const updateData: any = {};
    
    // Champs simples
    if (body.firstName !== undefined) updateData.firstName = body.firstName;
    if (body.lastName !== undefined) updateData.lastName = body.lastName;
    if (body.email !== undefined) updateData.email = body.email.toLowerCase();
    if (body.phone !== undefined) updateData.phone = body.phone || null;
    if (body.location !== undefined) updateData.location = body.location || null;
    if (body.role !== undefined) updateData.role = body.role || null;
    if (body.workPercent !== undefined) updateData.workPercent = body.workPercent;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes || null;
    
    // Gérer teamId directement (pas de syntaxe Prisma compliquée)
    if (body.teamId !== undefined) {
      if (body.teamId === 'none' || body.teamId === '' || !body.teamId) {
        updateData.teamId = null;
      } else {
        updateData.teamId = body.teamId;
      }
    }
    
    // STOCKAGE DIRECT du rotationConfig comme JSON (stringifié pour MSSQL)
    if (body.rotationConfig !== undefined) {
      if (body.rotationConfig && body.rotationConfig.patternId) {
        updateData.rotationConfig = toJsonString({
          patternId: body.rotationConfig.patternId,
          priority: body.rotationConfig.priority || 'medium',
          allowedShiftTypes: body.rotationConfig.allowedShiftTypes || []
        });
        console.log('Updating rotationConfig to:', updateData.rotationConfig);
      } else {
        updateData.rotationConfig = null;
        console.log('Removing rotation config');
      }
    }

    // Stocker availability comme JSON (stringifié pour MSSQL)
    if (body.availability !== undefined) {
      updateData.availability = toJsonString(body.availability);
    }
    
    console.log('Final updateData:', JSON.stringify(updateData, null, 2));
    
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        team: true,
        leadingTeam: true
      }
    });
    
    console.log('User updated successfully:', {
      name: `${user.firstName} ${user.lastName}`,
      rotationConfig: user.rotationConfig,
      rotationType: typeof user.rotationConfig
    });
    
    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'USER',
        entityId: user.id,
        data: toJsonString({ before: body, after: user })
      }
    });
    
    return NextResponse.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack');

    // Détecter l'erreur d'email en double (Prisma unique constraint violation)
    if (error instanceof Error && error.message.includes('Unique constraint failed on the fields: (`email`)')) {
      return NextResponse.json(
        {
          error: 'Cet email est déjà utilisé par un autre utilisateur',
          code: 'EMAIL_EXISTS'
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: 'Erreur lors de la modification de l\'utilisateur',
        details: error instanceof Error ? error.message : 'Erreur inconnue',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : null) : undefined
      },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer un utilisateur
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    // Vérifier si l'utilisateur est chef d'équipe
    const teamsLed = await prisma.team.findMany({
      where: { leadId: id }
    });
    
    if (teamsLed.length > 0) {
      // Retirer le chef d'équipe des équipes
      await prisma.team.updateMany({
        where: { leadId: id },
        data: { leadId: null }
      });
    }
    
    // Supprimer les assignations de l'utilisateur (cascade manuelle pour MSSQL)
    await prisma.shiftAssignment.deleteMany({ where: { userId: id } });

    // Supprimer l'utilisateur
    const user = await prisma.user.delete({
      where: { id }
    });
    
    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        entity: 'USER',
        entityId: id,
        data: toJsonString(user)
      }
    });
    
    return NextResponse.json(user);
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}