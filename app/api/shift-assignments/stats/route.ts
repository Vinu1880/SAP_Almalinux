// app/api/shift-assignments/stats/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';

// GET - Aggregate assignment statistics by status, user, and team
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.standard);
  if (rl) return rl;

  try {
    const { searchParams } = new URL(request.url);
    const dateFilter = searchParams.get('dateFilter');
    const teamId = searchParams.get('teamId');

    const where: any = {};

    if (dateFilter) {
      let startDate = new Date();
      if (dateFilter === '24h') {
        startDate.setHours(startDate.getHours() - 24);
      } else if (dateFilter === '7d') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (dateFilter === '30d') {
        startDate.setDate(startDate.getDate() - 30);
      } else if (dateFilter === '90d') {
        startDate.setDate(startDate.getDate() - 90);
      } else if (dateFilter === '180d') {
        startDate.setDate(startDate.getDate() - 180);
      }

      where.createdAt = {
        gte: startDate
      };
    }

    const allAssignments = await prisma.shiftAssignment.findMany({
      where,
      include: {
        shift: {
          select: {
            teamId: true
          }
        }
      }
    });

    let assignments = allAssignments;
    if (teamId) {
      assignments = allAssignments.filter(a => a.shift.teamId === teamId);
    }

    const accepted = assignments.filter(a => a.status === 'ACCEPTED').length;
    const refused = assignments.filter(a => a.status === 'REFUSED').length;
    const pending = assignments.filter(a => a.status === 'PENDING').length;
    const tentative = assignments.filter(a => a.status === 'TENTATIVE').length;
    const cancelled = assignments.filter(a => a.status === 'CANCELLED').length;
    const total = assignments.length;

    const userStats: any = {};
    assignments.forEach(assignment => {
      const userId = assignment.userId;
      if (!userStats[userId]) {
        userStats[userId] = {
          userId,
          total: 0,
          accepted: 0,
          refused: 0,
          pending: 0,
          tentative: 0,
          cancelled: 0
        };
      }
      userStats[userId].total++;
      userStats[userId][assignment.status.toLowerCase()]++;
    });

    const teamStats: any = {};
    allAssignments.forEach(assignment => {
      const teamId = assignment.shift.teamId;
      if (!teamStats[teamId]) {
        teamStats[teamId] = {
          teamId,
          total: 0,
          accepted: 0,
          refused: 0,
          pending: 0,
          tentative: 0,
          cancelled: 0
        };
      }
      teamStats[teamId].total++;
      teamStats[teamId][assignment.status.toLowerCase()]++;
    });

    return NextResponse.json({
      stats: {
        accepted,
        refused,
        pending,
        tentative,
        cancelled,
        total
      },
      userStats: Object.values(userStats),
      teamStats: Object.values(teamStats)
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
