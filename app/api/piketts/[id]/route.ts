// app/api/piketts/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

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
    
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description || null;
    if (body.teamId !== undefined) updateData.teamId = body.teamId;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.is24_7 !== undefined) updateData.is24_7 = body.is24_7;
    if (body.includedUserIds !== undefined) updateData.includedUserIds = body.includedUserIds;
    if (body.excludedUserIds !== undefined) updateData.excludedUserIds = body.excludedUserIds;
    if (body.daysOfWeek !== undefined) updateData.daysOfWeek = body.daysOfWeek;
    
    const pikett = await prisma.pikett.update({
      where: { id },
      data: updateData,
      include: {
        team: true
      }
    });
    
    return NextResponse.json(pikett);
  } catch (error) {
    console.error('Error updating pikett:', error);
    return NextResponse.json(
      { error: 'Failed to update pikett' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    await prisma.pikett.delete({
      where: { id }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting pikett:', error);
    return NextResponse.json(
      { error: 'Failed to delete pikett' },
      { status: 500 }
    );
  }
}