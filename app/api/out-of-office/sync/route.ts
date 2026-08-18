import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';

// Graph rejects getSchedule windows wider than ~62 days.
const CHUNK_DAYS = 60;
// Graph caps a getSchedule call at 20 mailboxes.
const MAILBOX_BATCH = 20;

const fmtDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Store the team's out-of-office periods so the planner can reason about past
 * absences.
 *
 * The planner only queries Graph for the range being previewed, but the
 * fairness ratio needs earlier absences too: without them someone back from
 * leave looks under-used and absorbs every shift. Fetching a whole year from
 * Graph on each preview would be slow and add load where MailboxConcurrency is
 * already tight, so the data is mirrored here instead.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  const graphToken = request.headers.get('X-Graph-Token');
  if (!graphToken) {
    return NextResponse.json({ error: 'Missing Graph access token' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const start = searchParams.get('start') || fmtDay(new Date(now.getFullYear(), 0, 1));
    const end = searchParams.get('end') || fmtDay(now);

    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { email: true },
    });
    const emails = users.map(u => u.email).filter(Boolean);
    if (emails.length === 0) {
      return NextResponse.json({ success: true, imported: 0, message: 'No active users' });
    }

    const chunks: Array<{ start: string; end: string }> = [];
    {
      const globalStart = new Date(start + 'T00:00:00');
      const globalEnd = new Date(end + 'T00:00:00');
      let cursor = new Date(globalStart);
      while (cursor.getTime() <= globalEnd.getTime()) {
        const chunkEnd = new Date(cursor);
        chunkEnd.setDate(chunkEnd.getDate() + CHUNK_DAYS - 1);
        const effectiveEnd = chunkEnd.getTime() > globalEnd.getTime() ? globalEnd : chunkEnd;
        chunks.push({ start: fmtDay(cursor), end: fmtDay(effectiveEnd) });
        cursor = new Date(effectiveEnd);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    type Row = { userEmail: string; subject: string; startDate: Date; endDate: Date; isAllDay: boolean; outlookId: string };
    const rows: Row[] = [];
    let graphErrors = 0;

    for (const chunk of chunks) {
      for (let i = 0; i < emails.length; i += MAILBOX_BATCH) {
        const batch = emails.slice(i, i + MAILBOX_BATCH);
        const res = await fetch('https://graph.microsoft.com/v1.0/me/calendar/getSchedule', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${graphToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'outlook.timezone="Europe/Zurich"',
          },
          body: JSON.stringify({
            schedules: batch,
            startTime: { dateTime: chunk.start + 'T00:00:00', timeZone: 'Europe/Zurich' },
            endTime: { dateTime: chunk.end + 'T23:59:59', timeZone: 'Europe/Zurich' },
            availabilityViewInterval: 60,
          }),
        });

        if (!res.ok) { graphErrors++; continue; }

        const data = await res.json();
        for (const schedule of data.value || []) {
          const email = (schedule.scheduleId || '').toLowerCase();
          if (!email || !schedule.scheduleItems) continue;

          for (const item of schedule.scheduleItems) {
            // Only real absences: 'busy' would pull in every ordinary meeting.
            if (item.status !== 'oof') continue;

            const startDate = new Date(item.start.dateTime);
            let endDate = new Date(item.end.dateTime);
            // All-day entries come back ending at next-day midnight (exclusive).
            const isAllDay = /T00:00(:00)?(\.\d+)?$/.test(item.end.dateTime as string);
            if (isAllDay) endDate = new Date(endDate.getTime() - 1000);

            rows.push({
              userEmail: email,
              subject: item.subject || 'Out of Office',
              startDate,
              endDate,
              isAllDay,
              // Stable per (user, slot) so re-syncing updates instead of duplicating.
              outlookId: `sched-${email}-${item.start.dateTime}-${item.end.dateTime}`,
            });
          }
        }
      }
    }

    // Replace the window rather than append, so absences cancelled in Outlook
    // disappear here too. Scoped to the synced range to preserve older data.
    const written = await prisma.$transaction(async (tx) => {
      await tx.outOfOfficeEvent.deleteMany({
        where: {
          startDate: { lte: new Date(end + 'T23:59:59') },
          endDate: { gte: new Date(start + 'T00:00:00') },
        },
      });
      if (rows.length === 0) return 0;
      const result = await tx.outOfOfficeEvent.createMany({ data: rows, skipDuplicates: true });
      return result.count;
    }, { maxWait: 15000, timeout: 15000 });

    await prisma.auditLog.create({
      data: {
        action: 'SYNC',
        entity: 'OUT_OF_OFFICE',
        userId: auth.user.id,
        data: { start, end, written, graphErrors, users: emails.length },
      },
    });

    return NextResponse.json({ success: true, imported: written, range: { start, end }, graphErrors });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to sync out-of-office events' },
      { status: 500 }
    );
  }
}
