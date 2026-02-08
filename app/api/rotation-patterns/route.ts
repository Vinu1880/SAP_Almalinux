// app/api/rotation-patterns/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const patterns = await prisma.rotationPattern.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    return NextResponse.json(patterns);
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
        weeks: body.weeks
      }
    });
    return NextResponse.json(pattern);
  } catch (error) {
    console.error('Error creating rotation pattern:', error);
    return NextResponse.json({ error: 'Failed to create rotation pattern' }, { status: 500 });
  }
}