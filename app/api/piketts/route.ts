// app/api/piketts/route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { toJsonString, fromJsonString } from '@/lib/json-helpers';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const piketts = await prisma.pikett.findMany({
      include: {
        team: true,
        user: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Parse string fields back to arrays for frontend
    const normalizedPiketts = piketts.map(pikett => ({
      ...pikett,
      daysOfWeek: fromJsonString(pikett.daysOfWeek),
      includedUserIds: fromJsonString(pikett.includedUserIds),
      excludedUserIds: fromJsonString(pikett.excludedUserIds),
    }));

    return NextResponse.json(normalizedPiketts);
  } catch (error) {
    console.error('Error fetching piketts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch piketts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    const pikett = await prisma.pikett.create({
      data: {
        name: body.name,
        description: body.description || null,
        startWeek: body.startWeek || '',
        endWeek: body.endWeek || null,
        teamId: body.teamId,
        color: body.color || '#dc2626',
        status: body.status || 'ACTIVE',
        is24_7: body.is24_7 !== undefined ? body.is24_7 : true,
        includedUserIds: toJsonString(body.includedUserIds || []),
        excludedUserIds: toJsonString(body.excludedUserIds || []),
        daysOfWeek: toJsonString(body.daysOfWeek || [0, 1, 2, 3, 4, 5, 6])
      },
      include: {
        team: true
      }
    });
    
    return NextResponse.json(pikett, { status: 201 });
  } catch (error) {
    console.error('Error creating pikett:', error);
    return NextResponse.json(
      { error: 'Failed to create pikett' },
      { status: 500 }
    );
  }
}