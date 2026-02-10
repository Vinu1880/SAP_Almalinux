// app/api/rotation-patterns/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { toJsonString, fromJsonString } from '@/lib/json-helpers';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const patterns = await prisma.rotationPattern.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Parse string fields back to objects for frontend
    const normalizedPatterns = patterns.map(pattern => ({
      ...pattern,
      weeks: fromJsonString(pattern.weeks),
      userShifts: fromJsonString(pattern.userShifts),
    }));

    return NextResponse.json(normalizedPatterns);
  } catch (error) {
    console.error('Error fetching rotation patterns:', error);
    return NextResponse.json({ error: 'Failed to fetch rotation patterns' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const pattern = await prisma.rotationPattern.create({
      data: {
        name: body.name,
        description: body.description || null,
        cycleLength: body.cycleLength,
        weeks: toJsonString(body.weeks),
        userShifts: toJsonString(body.userShifts || [])
      }
    });
    return NextResponse.json(pattern);
  } catch (error) {
    console.error('Error creating rotation pattern:', error);
    return NextResponse.json({ error: 'Failed to create rotation pattern' }, { status: 500 });
  }
}