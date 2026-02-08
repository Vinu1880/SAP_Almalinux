// app/api/rotation-patterns/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET - Récupérer un pattern spécifique
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const pattern = await prisma.rotationPattern.findUnique({
      where: { id }
    });

    if (!pattern) {
      return NextResponse.json(
        { error: 'Pattern not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(pattern);
  } catch (error) {
    console.error('Error fetching rotation pattern:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rotation pattern' },
      { status: 500 }
    );
  }
}

// PUT - Mettre à jour un pattern
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    const pattern = await prisma.rotationPattern.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description || null,
        cycleLength: body.cycleLength,
        weeks: body.weeks
      }
    });

    return NextResponse.json(pattern);
  } catch (error) {
    console.error('Error updating rotation pattern:', error);
    return NextResponse.json(
      { error: 'Failed to update rotation pattern' },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer un pattern
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const pattern = await prisma.rotationPattern.delete({
      where: { id }
    });

    return NextResponse.json(pattern);
  } catch (error) {
    console.error('Error deleting rotation pattern:', error);
    return NextResponse.json(
      { error: 'Failed to delete rotation pattern' },
      { status: 500 }
    );
  }
}
