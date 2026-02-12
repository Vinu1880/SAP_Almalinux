// app/api/holidays/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// PUT - Update a holiday
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, date, cantons, type, recurring, description } = body;

    const holiday = await prisma.holiday.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(cantons !== undefined && { cantons }),
        ...(type !== undefined && { type }),
        ...(recurring !== undefined && { recurring }),
        ...(description !== undefined && { description })
      }
    });

    return NextResponse.json(holiday);
  } catch (error) {
    console.error('Error updating holiday:', error);
    return NextResponse.json(
      { error: 'Failed to update holiday' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a holiday
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    await prisma.holiday.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting holiday:', error);
    return NextResponse.json(
      { error: 'Failed to delete holiday' },
      { status: 500 }
    );
  }
}
