import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// Mock OOF events from DB in Graph-schedule shape (planner uses this instead of MS Graph)
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  if (!start || !end) {
    return NextResponse.json({ error: 'start and end are required' }, { status: 400 });
  }

  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T23:59:59');

  const events = await prisma.outOfOfficeEvent.findMany({
    where: {
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    orderBy: { startDate: 'asc' },
  });

  // Local naive ISO (no Z) matches seed wall-clock; allDay normalised to Outlook exclusive-end shape
  const fmt = (d: Date): string => {
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const hr = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const se = String(d.getSeconds()).padStart(2, '0');
    return `${yr}-${mo}-${da}T${hr}:${mi}:${se}`;
  };

  const mapped = events.map((e) => {
    let start = e.startDate;
    let end = e.endDate;
    if (e.isAllDay) {
      const s = new Date(e.startDate);
      s.setHours(0, 0, 0, 0);
      const eDate = new Date(e.endDate);
      eDate.setDate(eDate.getDate() + 1);
      eDate.setHours(0, 0, 0, 0);
      start = s;
      end = eDate;
    }
    return {
      id: e.id,
      subject: e.subject,
      start: { dateTime: fmt(start) },
      end: { dateTime: fmt(end) },
      showAs: 'oof',
      isAllDay: e.isAllDay,
      organizer: { emailAddress: { address: e.userEmail.toLowerCase(), name: '' } },
      attendees: [{ emailAddress: { address: e.userEmail.toLowerCase(), name: '' } }],
    };
  });

  return NextResponse.json(mapped);
}
