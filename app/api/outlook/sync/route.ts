// app/api/outlook/sync/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// POST - Synchroniser les événements Out of Office depuis Outlook
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { events } = body;
    
    // Supprimer les anciens événements
    await prisma.outOfOfficeEvent.deleteMany({
      where: {
        endDate: {
          lt: new Date()
        }
      }
    });
    
    // Créer ou mettre à jour les nouveaux événements
    const syncedEvents = await Promise.all(
      events.map(async (event: any) => {
        if (event.outlookId) {
          return await prisma.outOfOfficeEvent.upsert({
            where: { outlookId: event.outlookId },
            update: {
              userEmail: event.userEmail.toLowerCase(),
              subject: event.subject,
              startDate: new Date(event.startDate),
              endDate: new Date(event.endDate),
              isAllDay: event.isAllDay,
              calendarName: event.calendarName,
              syncedAt: new Date()
            },
            create: {
              userEmail: event.userEmail.toLowerCase(),
              subject: event.subject,
              startDate: new Date(event.startDate),
              endDate: new Date(event.endDate),
              isAllDay: event.isAllDay,
              outlookId: event.outlookId,
              calendarName: event.calendarName
            }
          });
        } else {
          return await prisma.outOfOfficeEvent.create({
            data: {
              userEmail: event.userEmail.toLowerCase(),
              subject: event.subject,
              startDate: new Date(event.startDate),
              endDate: new Date(event.endDate),
              isAllDay: event.isAllDay,
              calendarName: event.calendarName
            }
          });
        }
      })
    );
    
    return NextResponse.json({
      success: true,
      synced: syncedEvents.length,
      events: syncedEvents
    });
  } catch (error) {
    console.error('Error syncing Outlook events:', error);
    return NextResponse.json(
      { error: 'Failed to sync events' },
      { status: 500 }
    );
  }
}

// GET - Récupérer les événements OOF pour une période
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const userEmail = searchParams.get('userEmail');
    
    const where: any = {};
    
    if (userEmail) {
      where.userEmail = userEmail.toLowerCase();
    }
    
    if (startDate && endDate) {
      where.AND = [
        { startDate: { lte: new Date(endDate) } },
        { endDate: { gte: new Date(startDate) } }
      ];
    }
    
    const events = await prisma.outOfOfficeEvent.findMany({
      where,
      orderBy: {
        startDate: 'asc'
      }
    });
    
    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching OOF events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}