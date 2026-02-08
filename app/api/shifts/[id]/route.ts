// app/api/shifts/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET - Récupérer un shift par ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        team: true,
        assignments: true
      }
    });
    
    if (!shift) {
      return NextResponse.json(
        { error: 'Shift not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(shift);
  } catch (error) {
    console.error('Error fetching shift:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shift' },
      { status: 500 }
    );
  }
}

// PUT - Mettre à jour un shift
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
    if (body.startTime !== undefined) updateData.startTime = body.startTime;
    if (body.endTime !== undefined) updateData.endTime = body.endTime;
    if (body.teamId !== undefined) updateData.teamId = body.teamId;
    if (body.membersRequired !== undefined) updateData.membersRequired = body.membersRequired;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.includedUserIds !== undefined) updateData.includedUserIds = body.includedUserIds;
    if (body.excludedUserIds !== undefined) updateData.excludedUserIds = body.excludedUserIds;
    if (body.daysOfWeek !== undefined) updateData.daysOfWeek = body.daysOfWeek;
    
    const shift = await prisma.shift.update({
      where: { id },
      data: updateData,
      include: {
        team: true
      }
    });
    
    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'SHIFT',
        entityId: shift.id,
        data: { 
          before: body, 
          after: shift 
        } as any
      }
    });
    
    return NextResponse.json(shift);
  } catch (error) {
    console.error('Error updating shift:', error);
    return NextResponse.json(
      { error: 'Failed to update shift', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer un shift
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    // Supprimer le shift (les assignations seront supprimées en cascade grâce à onDelete: Cascade)
    const shift = await prisma.shift.delete({
      where: { id }
    });
    
    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        entity: 'SHIFT',
        entityId: id,
        data: shift as any
      }
    });
    
    return NextResponse.json({ success: true, deleted: shift });
  } catch (error) {
    console.error('Error deleting shift:', error);
    return NextResponse.json(
      { error: 'Failed to delete shift', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}