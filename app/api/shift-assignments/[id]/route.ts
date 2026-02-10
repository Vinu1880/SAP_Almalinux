// app/api/shift-assignments/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { toJsonString } from '@/lib/json-helpers';

// GET - Récupérer une assignation spécifique
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const assignment = await prisma.shiftAssignment.findUnique({
      where: { id },
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
      }
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(assignment);
  } catch (error) {
    console.error('Error fetching shift assignment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shift assignment' },
      { status: 500 }
    );
  }
}

// PUT - Mettre à jour une assignation (généralement le status)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: any = {};

    if (body.status !== undefined) {
      updateData.status = body.status;

      // Si le status change vers ACCEPTED ou REFUSED, enregistrer la date de réponse
      if (body.status === 'ACCEPTED' || body.status === 'REFUSED') {
        updateData.respondedAt = new Date();
      }
    }

    if (body.reason !== undefined) {
      updateData.reason = body.reason;
    }

    if (body.outlookEventId !== undefined) {
      updateData.outlookEventId = body.outlookEventId;
    }

    const assignment = await prisma.shiftAssignment.update({
      where: { id },
      data: updateData,
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
      }
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'SHIFT_ASSIGNMENT',
        entityId: assignment.id,
        data: toJsonString({ before: body, after: assignment })
      }
    });

    return NextResponse.json(assignment);
  } catch (error) {
    console.error('Error updating shift assignment:', error);
    return NextResponse.json(
      { error: 'Failed to update shift assignment' },
      { status: 500 }
    );
  }
}

// PATCH - Mettre à jour partiellement une assignation (ex: outlookEventId)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    const assignment = await prisma.shiftAssignment.update({
      where: { id },
      data: body,
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
      }
    });

    return NextResponse.json(assignment);
  } catch (error) {
    console.error('Error patching shift assignment:', error);
    return NextResponse.json(
      { error: 'Failed to patch shift assignment' },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer une assignation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const assignment = await prisma.shiftAssignment.delete({
      where: { id }
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        entity: 'SHIFT_ASSIGNMENT',
        entityId: id,
        data: toJsonString(assignment)
      }
    });

    return NextResponse.json({ success: true, deleted: assignment });
  } catch (error) {
    console.error('Error deleting shift assignment:', error);
    return NextResponse.json(
      { error: 'Failed to delete shift assignment' },
      { status: 500 }
    );
  }
}
