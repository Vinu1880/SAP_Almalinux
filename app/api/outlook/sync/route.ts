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

    // ACCEPTED is included to catch cancellations from the shared mailbox, and
    // REFUSED because a decline is not final: someone who said no can accept the
    // same invitation later, and a row left out of this query would stay refused
    // for good. CANCELLED stays out — that slot is closed.
    const syncableStatuses = ['PENDING', 'TENTATIVE', 'ACCEPTED', 'REFUSED'] as const;
    const [pendingShifts, pendingPiketts] = await Promise.all([
      prisma.shiftAssignment.findMany({
        where: {
          status: { in: [...syncableStatuses] },
          outlookEventId: { not: null }
        },
        include: { user: true, shift: true }
      }),
      prisma.pikettAssignment.findMany({
        where: {
          status: { in: [...syncableStatuses] },
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
    // Subject rewrites the caller must push to Graph: the sync runs server-side
    // and has no delegated token of its own.
    const ccDeclines: any[] = [];

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

        // A refusal outlives its invitation: resending the slot to someone
        // else cancels the refused event, and the dashboard still has to show
        // who said no. Only rows that were still live become CANCELLED.
        const isLive = assignment.status !== 'CANCELLED' && assignment.status !== 'REFUSED';

        if (!eventResponse.ok) {
          if (eventResponse.status === 404) {
            if (isLive) {
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
          if (isLive) {
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

        // The attendee's own calendar is the source of truth, so it is read
        // whatever the organizer copy says — not only when that copy is empty.
        //
        // Two things go wrong otherwise. Accepting without sending a response
        // leaves the organizer at 'none', and re-inviting the same person for
        // the same slot can carry their earlier decline over to the new
        // invitation: the organizer then reports a refusal the person has
        // already taken back, and the row stays wrong for good.
        if (event.iCalUId) {
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
                // Overrides the organizer copy on purpose: this is what the
                // person actually answered, most recently.
                responseStatus = localResponse;
              } else if (!localEvent && (responseStatus === 'none' || !responseStatus)) {
                // Declining drops the event from the attendee's calendar, even
                // when no response is sent. The organizer copy still exists, so
                // a missing local copy points to a decline — but an invitation
                // still sitting unopened in the inbox looks the same. Only read
                // it as a decline once the invite has had a day to be handled.
                const sentAt = new Date(assignment.createdAt).getTime();
                const ageHours = (Date.now() - sentAt) / 3600000;
                if (ageHours >= 24) {
                  responseStatus = 'declined';
                } else {
                  console.warn(
                    `[outlook/sync] ${user.email}: event missing from calendar but ` +
                    `invite is ${Math.round(ageHours)}h old — left as no answer`
                  );
                }
              }
            } else {
              // Reading another mailbox needs Calendars.Read on that user. A 403
              // here is the difference between "no answer yet" and "we cannot
              // see the answer", so it must not stay silent.
              console.warn(
                `[outlook/sync] attendee lookup failed for ${user.email}: ${localResp.status}`
              );
            }
          } catch (e) {
            console.warn(`[outlook/sync] attendee lookup error for ${user.email}:`, e);
          }
        }

        // Copied people who declined: drop them from the row and hand the
        // caller what the subject should become. Leaving them on keeps the
        // shared calendar reading "with Luis" when Luis said no — the team then
        // treats him as busy while he is free.
        const currentCc: string[] = (assignment as any).ccUserIds || [];
        if (currentCc.length > 0) {
          const ccUsers = await prisma.user.findMany({
            where: { id: { in: currentCc } },
            select: { id: true, email: true, firstName: true, lastName: true },
          });
          // Same rule as the holder: the organizer copy only learns of a decline
          // when a response is sent, so the copied person's own calendar wins.
          const ccDeclined = async (cc: { email: string }): Promise<boolean> => {
            const att = event.attendees?.find(
              (a: any) => a.emailAddress?.address?.toLowerCase() === cc.email.toLowerCase()
            );
            if (att?.status?.response === 'declined') return true;
            if (!event.iCalUId) return false;
            try {
              const r = await fetch(
                `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cc.email)}/events?$filter=iCalUId eq '${event.iCalUId}'&$select=responseStatus&$top=1`,
                { headers: { 'Authorization': `Bearer ${graphToken}` } }
              );
              if (!r.ok) {
                console.warn(`[outlook/sync] CC lookup failed for ${cc.email}: ${r.status}`);
                return false;
              }
              const local = (await r.json()).value?.[0];
              if (local) return local.responseStatus?.response === 'declined';
              // Declining removes the event from the calendar; an unopened
              // invite looks the same, so wait a day before reading it as no.
              return (Date.now() - new Date(assignment.createdAt).getTime()) / 3600000 >= 24;
            } catch (e) {
              console.warn(`[outlook/sync] CC lookup error for ${cc.email}:`, e);
              return false;
            }
          };
          const declinedCcIds: string[] = [];
          for (const cc of ccUsers) {
            if (await ccDeclined(cc)) declinedCcIds.push(cc.id);
          }

          if (declinedCcIds.length > 0) {
            const remaining = currentCc.filter(id => !declinedCcIds.includes(id));
            await updateStatus({ ccUserIds: remaining } as any);
            ccDeclines.push({
              assignmentId: id,
              outlookEventId: assignment.outlookEventId!,
              mailbox,
              removed: declinedCcIds,
              remainingCc: ccUsers.filter(u => remaining.includes(u.id)),
              holder: { firstName: user.firstName, lastName: user.lastName, email: user.email },
              itemName: _kind === 'pikett'
                ? (assignment as any).pikett?.name
                : (assignment as any).shift?.name,
            });
            await prisma.auditLog.create({
              data: {
                action: 'UPDATE',
                entity: entityLabel,
                entityId: id,
                userId: auth.user.id,
                data: { source: 'outlook-sync', reason: 'CC declined', removed: declinedCcIds },
              },
            });
          }
        }

        // The event can still list someone who is no longer copied: a decline
        // handled before attendees were pruned, or a copy removed by hand. Hand
        // it back so the browser rewrites the attendee list and the subject.
        if (assignment.status !== 'REFUSED' && !ccDeclines.some(d => d.outlookEventId === assignment.outlookEventId)) {
          const optionalOnEvent: string[] = (event.attendees || [])
            .filter((a: any) => a.type === 'optional')
            .map((a: any) => String(a.emailAddress?.address || '').toLowerCase())
            .filter(Boolean);
          if (optionalOnEvent.length > 0) {
            const keptIds: string[] = (assignment as any).ccUserIds || [];
            const kept = keptIds.length > 0
              ? await prisma.user.findMany({
                  where: { id: { in: keptIds } },
                  select: { id: true, email: true, firstName: true, lastName: true },
                })
              : [];
            const keptEmails = new Set(kept.map(u => (u.email || '').toLowerCase()));
            if (optionalOnEvent.some(e => !keptEmails.has(e))) {
              ccDeclines.push({
                assignmentId: id,
                outlookEventId: assignment.outlookEventId!,
                mailbox,
                removed: [],
                remainingCc: kept,
                holder: { firstName: user.firstName, lastName: user.lastName, email: user.email },
                itemName: _kind === 'pikett'
                  ? (assignment as any).pikett?.name
                  : (assignment as any).shift?.name,
              });
            }
          }
        }

        if (!responseStatus || responseStatus === 'none') continue;

        const newStatus = mapOutlookResponseToStatus(responseStatus);

        if (newStatus !== 'PENDING' && newStatus !== assignment.status) {
          await updateStatus({ status: newStatus, respondedAt: new Date() });

          // The holder said no, so nobody is covering the slot. Copied people
          // were only watching it — leaving them on the event keeps a shift in
          // their calendar that no longer exists.
          if (newStatus === 'REFUSED') {
            const stillCc: string[] = (assignment as any).ccUserIds || [];
            if (stillCc.length > 0) {
              await updateStatus({ ccUserIds: [] } as any);
              ccDeclines.push({
                assignmentId: id,
                outlookEventId: assignment.outlookEventId!,
                mailbox,
                removed: stillCc,
                remainingCc: [],
                dropAttendees: true,
                holder: { firstName: user.firstName, lastName: user.lastName, email: user.email },
                itemName: _kind === 'pikett'
                  ? (assignment as any).pikett?.name
                  : (assignment as any).shift?.name,
              });
            }
          }

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
      errors: errorCount,
      ccDeclines
    });

  } catch (error) {
    console.error('[outlook/sync] Synchronization failed:', error);
    return NextResponse.json({ error: 'Synchronization failed', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
