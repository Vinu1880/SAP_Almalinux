// app/api/rotation-patterns/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';
import { validateBody, updateRotationPatternSchema } from '@/lib/validation';

// GET - Retrieve a specific pattern
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

// PUT - Update a pattern
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

    const validation = validateBody(updateRotationPatternSchema, body);
    if (validation.success === false) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const pattern = await prisma.rotationPattern.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description || null,
        cycleLength: body.cycleLength,
        weeks: body.weeks,
        userShifts: body.userShifts || []
      }
    });

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'ROTATION_PATTERN',
        entityId: pattern.id,
        userId: auth.user.id,
        data: pattern
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

// DELETE - Delete a pattern
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

    const pattern = await prisma.rotationPattern.delete({
      where: { id }
    });

    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        entity: 'ROTATION_PATTERN',
        entityId: pattern.id,
        userId: auth.user.id,
        data: pattern
      }
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
