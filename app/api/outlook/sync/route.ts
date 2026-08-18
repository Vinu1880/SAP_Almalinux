// Syncs Outlook attendee responses back to DB assignments
// Reads attendee accept/decline status from shared mailbox calendar events

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';

function mapOutlookResponseToStatus(response: string): 'ACCEPTED' | 'TENTATIVE' | 'REFUSED' | 'PENDING' {
  switch (response?.toLowerCase()) {
    case 'accepted':
      return 'ACCEPTED';
    case 'tentativelyaccepted':
      return 'TENTATIVE';
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

    // Include ACCEPTED to detect cancellations from shared mailbox
    const [pendingShifts, pendingPiketts] = await Promise.all([
      prisma.shiftAssignment.findMany({
        where: {
          status: { in: ['PENDING', 'TENTATIVE', 'ACCEPTED'] },
          outlookEventId: { not: null }
        },
        include: { user: true, shift: true }
      }),
      prisma.pikettAssignment.findMany({
        where: {
          status: { in: ['PENDING', 'TENTATIVE', 'ACCEPTED'] },
          outlookEventId: { not: null }
        },
        include: { user: true, pikett: true }
      })
    ]);

    const pendingAssignments = [
      ...pendingShifts.map(a => ({ ...a, _kind: 'shift' as const, _mailbox: a.shift.senderMailbox || 'me' })),
      ...pendingPiketts.map(a => ({ ...a, _kind: 'pikett' as const, _mailbox: a.pikett.senderMailbox || 'me' })),
    ];

    if (pendingAssignments.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending assignments to sync', updated: 0, errors: 0 });
    }

    let updatedCount = 0;
    let errorCount = 0;

    for (const assignment of pendingAssignments) {
      try {
        const { outlookEventId, user, id, _kind, _mailbox } = assignment as any;
        if (!outlookEventId) continue;

        const mailbox = _mailbox;
        const eventUrl = mailbox === 'me'
          ? `https://graph.microsoft.com/v1.0/me/events/${outlookEventId}`
          : `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/calendar/events/${outlookEventId}`;

        const eventResponse = await fetch(eventUrl, {
          headers: { 'Authorization': `Bearer ${graphToken}` }
        });

        const entityLabel = _kind === 'pikett' ? 'PIKETT_ASSIGNMENT' : 'SHIFT_ASSIGNMENT';
        const updateStatus = (data: any) => _kind === 'pikett'
          ? prisma.pikettAssignment.update({ where: { id }, data })
          : prisma.shiftAssignment.update({ where: { id }, data });

        if (!eventResponse.ok) {
          if (eventResponse.status === 404) {
            if (assignment.status !== 'CANCELLED') {
              await updateStatus({ status: 'CANCELLED', respondedAt: new Date() });
              await prisma.auditLog.create({
                data: {
                  action: 'UPDATE',
                  entity: entityLabel,
                  entityId: id,
                  userId: auth.user.id,
                  data: {
                    source: 'outlook-sync',
                    oldStatus: assignment.status,
                    newStatus: 'CANCELLED',
                    reason: 'Event deleted from Outlook'
                  }
                }
              });
              updatedCount++;
            }
            continue;
          }
          errorCount++;
          continue;
        }

        const event = await eventResponse.json();

        if (event.isCancelled === true) {
          if (assignment.status !== 'CANCELLED') {
            await updateStatus({ status: 'CANCELLED', respondedAt: new Date() });
            await prisma.auditLog.create({
              data: {
                action: 'UPDATE',
                entity: entityLabel,
                entityId: id,
                userId: auth.user.id,
                data: {
                  source: 'outlook-sync',
                  oldStatus: assignment.status,
                  newStatus: 'CANCELLED',
                  reason: 'Event cancelled from Outlook'
                }
              }
            });
            updatedCount++;
          }
          continue;
        }

        const attendee = event.attendees?.find(
          (a: any) => a.emailAddress?.address?.toLowerCase() === user.email.toLowerCase()
        );

        let responseStatus: string = attendee?.status?.response || 'none';

        // Fallback: when the attendee accepted without sending a response back,
        // the organizer copy still shows 'none'. Query the attendee's own
        // calendar via iCalUId and read the local responseStatus.
        if ((responseStatus === 'none' || !responseStatus) && event.iCalUId) {
          try {
            const localUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(user.email)}/events?$filter=iCalUId eq '${event.iCalUId}'&$select=responseStatus&$top=1`;
            const localResp = await fetch(localUrl, {
              headers: { 'Authorization': `Bearer ${graphToken}` }
            });
            if (localResp.ok) {
              const localData = await localResp.json();
              const localEvent = localData.value?.[0];
              const localResponse = localEvent?.responseStatus?.response;
              if (localResponse && localResponse !== 'none') {
                responseStatus = localResponse;
              }
            }
          } catch { /* fallback failed — keep 'none' */ }
        }

        if (!responseStatus || responseStatus === 'none') continue;

        const newStatus = mapOutlookResponseToStatus(responseStatus);

        if (newStatus !== 'PENDING' && newStatus !== assignment.status) {
          await updateStatus({ status: newStatus, respondedAt: new Date() });

          // A decline is deliberately left on the calendar. Cancelling it made
          // the slot vanish, so a refused shift read as "not planned" instead of
          // "declined" — the planner could no longer see it needed reassigning.
          // Outlook already shows the attendee's declined state on the event.

          await prisma.auditLog.create({
            data: {
              action: 'UPDATE',
              entity: entityLabel,
              entityId: id,
              userId: auth.user.id,
              data: {
                source: 'outlook-sync',
                oldStatus: assignment.status,
                newStatus,
                outlookResponse: responseStatus,
                outlookEventDeleted: false
              }
            }
          });

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
      errors: errorCount
    });

  } catch (error) {
    console.error('[outlook/sync] Synchronization failed:', error);
    return NextResponse.json({ error: 'Synchronization failed', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
