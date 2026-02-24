// app/api/outlook/sync/route.ts
// Sync Outlook responses using multiple strategies:
// 1) Check tracking event attendees on shared mailbox
// 2) Search attendee's calendar (works for accepted, not for declined since event is removed)
// 3) Search shared mailbox inbox for accept/decline response messages

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';

function mapResponseToStatus(responseType: string): 'ACCEPTED' | 'REFUSED' | 'PENDING' {
  switch (responseType?.toLowerCase()) {
    case 'accepted':
    case 'organizer':
    case 'tentativelyaccepted':
      return 'ACCEPTED';
    case 'declined':
      return 'REFUSED';
    default:
      return 'PENDING';
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const graphToken = request.headers.get('X-Graph-Token');
    if (!graphToken) {
      return NextResponse.json({ error: 'Missing Graph access token' }, { status: 401 });
    }

    const pendingAssignments = await prisma.shiftAssignment.findMany({
      where: {
        status: 'PENDING',
        outlookEventId: { not: null }
      },
      include: { user: true, shift: true }
    });

    if (pendingAssignments.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending assignments to sync', updated: 0, errors: 0 });
    }

    let updatedCount = 0;
    let errorCount = 0;
    const details: any[] = [];

    for (const assignment of pendingAssignments) {
      try {
        const { outlookEventId, user, shift, id } = assignment;
        if (!outlookEventId || outlookEventId.startsWith('mime-uid:')) continue;

        const mailbox = shift.senderMailbox || 'me';
        let newStatus: 'ACCEPTED' | 'REFUSED' | 'PENDING' = 'PENDING';
        let source = '';

        // Strategy 1: Check the tracking event on the organizer's calendar
        const eventUrl = mailbox === 'me'
          ? `https://graph.microsoft.com/v1.0/me/events/${outlookEventId}`
          : `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/calendar/events/${outlookEventId}`;

        try {
          const eventRes = await fetch(eventUrl, {
            headers: { 'Authorization': `Bearer ${graphToken}` }
          });
          if (eventRes.ok) {
            const event = await eventRes.json();
            const att = event.attendees?.find(
              (a: any) => a.emailAddress?.address?.toLowerCase() === user.email.toLowerCase()
            );
            if (att?.status?.response) {
              const mapped = mapResponseToStatus(att.status.response);
              if (mapped !== 'PENDING') {
                newStatus = mapped;
                source = 'tracking-event';
              }
            }
          }
        } catch { /* continue */ }

        // Strategy 2: Search attendee's calendar (finds accepted events)
        if (newStatus === 'PENDING') {
          try {
            const assignDate = assignment.date instanceof Date ? assignment.date : new Date(assignment.date);
            const dateStr = assignDate.toISOString().split('T')[0];
            const dayStart = `${dateStr}T00:00:00.000Z`;
            const dayEnd = `${dateStr}T23:59:59.999Z`;

            const searchRes = await fetch(
              `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(user.email)}/calendarView?startDateTime=${encodeURIComponent(dayStart)}&endDateTime=${encodeURIComponent(dayEnd)}&$select=id,subject,responseStatus&$top=50`,
              {
                headers: {
                  'Authorization': `Bearer ${graphToken}`,
                  'Prefer': 'outlook.timezone="Europe/Zurich"',
                }
              }
            );

            if (searchRes.ok) {
              const searchData = await searchRes.json();
              const matchingEvent = searchData.value?.find(
                (e: any) => e.subject?.includes(shift.name)
              );
              if (matchingEvent?.responseStatus?.response) {
                const mapped = mapResponseToStatus(matchingEvent.responseStatus.response);
                if (mapped !== 'PENDING') {
                  newStatus = mapped;
                  source = 'user-calendar';
                }
              }
            }
          } catch { /* continue */ }
        }

        // Strategy 3: Search shared mailbox inbox for decline/accept response messages
        // When a user declines, Outlook sends a "Declined: <subject>" message to the organizer
        if (newStatus === 'PENDING' && mailbox !== 'me') {
          try {
            // Search for response messages from this user about this shift
            const filterParts = [
              `from/emailAddress/address eq '${user.email.toLowerCase()}'`,
              `contains(subject, '${shift.name.replace(/'/g, "''")}')`,
            ];
            const filter = filterParts.join(' and ');

            const messagesRes = await fetch(
              `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages?$filter=${encodeURIComponent(filter)}&$select=subject,from,receivedDateTime,itemClass&$top=10&$orderby=receivedDateTime desc`,
              {
                headers: { 'Authorization': `Bearer ${graphToken}` }
              }
            );

            if (messagesRes.ok) {
              const messagesData = await messagesRes.json();
              for (const msg of messagesData.value || []) {
                const itemClass = (msg.itemClass || '').toLowerCase();
                const subjectLower = (msg.subject || '').toLowerCase();

                // Check itemClass for meeting responses
                if (itemClass.includes('ipm.schedule.meeting.resp.neg') || subjectLower.startsWith('declined:') || subjectLower.startsWith('refusé:') || subjectLower.startsWith('abgelehnt:')) {
                  newStatus = 'REFUSED';
                  source = 'inbox-decline';
                  break;
                }
                if (itemClass.includes('ipm.schedule.meeting.resp.pos') || subjectLower.startsWith('accepted:') || subjectLower.startsWith('accepté:') || subjectLower.startsWith('akzeptiert:')) {
                  newStatus = 'ACCEPTED';
                  source = 'inbox-accept';
                  break;
                }
                if (itemClass.includes('ipm.schedule.meeting.resp.tent') || subjectLower.startsWith('tentative:') || subjectLower.startsWith('tentativement:') || subjectLower.startsWith('mit vorbehalt:')) {
                  newStatus = 'ACCEPTED';
                  source = 'inbox-tentative';
                  break;
                }
              }
            }
          } catch { /* continue */ }
        }

        if (newStatus !== 'PENDING' && newStatus !== assignment.status) {
          await prisma.shiftAssignment.update({
            where: { id },
            data: { status: newStatus, respondedAt: new Date() }
          });

          // If refused, delete the tracking event from shared mailbox calendar
          if (newStatus === 'REFUSED' && outlookEventId) {
            try {
              await fetch(eventUrl, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${graphToken}` }
              });
            } catch { /* continue */ }
          }

          await prisma.auditLog.create({
            data: {
              action: 'UPDATE',
              entity: 'SHIFT_ASSIGNMENT',
              entityId: id,
              userId: auth.user.id,
              data: { source: `outlook-sync-${source}`, oldStatus: assignment.status, newStatus }
            }
          });

          details.push({ user: user.email, shift: shift.name, oldStatus: assignment.status, newStatus, source });
          updatedCount++;
        }
      } catch {
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Synchronization completed',
      checked: pendingAssignments.length,
      updated: updatedCount,
      errors: errorCount,
      details,
    });

  } catch {
    return NextResponse.json({ error: 'Synchronization failed' }, { status: 500 });
  }
}
