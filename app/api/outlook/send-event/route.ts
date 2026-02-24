// app/api/outlook/send-event/route.ts
// Server-side proxy for Outlook calendar events using delegated permissions
// Shared mailboxes: MIME sendMail (organizer = shared mailbox) + Calendar API (tracking)
// Personal calendar: Calendar API directly
// Requires: Mail.Send.Shared, Calendars.ReadWrite.Shared (delegated) + Exchange "Send As"

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';

function getGraphToken(request: NextRequest): string | null {
  return request.headers.get('X-Graph-Token') || null;
}

function generateUID(domain: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let uid = '';
  for (let i = 0; i < 32; i++) uid += chars[Math.floor(Math.random() * chars.length)];
  return `${uid}@${domain}`;
}

// Convert ISO UTC datetime to Europe/Zurich local time for iCalendar
// Input: "2026-03-03T07:00:00.000Z" (UTC) → Output: "20260303T080000" (CET, UTC+1)
// The DTSTART/DTEND use TZID=Europe/Zurich so the time must be in local Swiss time
function formatICalDate(isoDate: string, timeZone: string): string {
  const d = new Date(isoDate);
  // Use Intl.DateTimeFormat to get the correct local time in the target timezone
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
  return `${get('year')}${get('month')}${get('day')}T${get('hour')}${get('minute')}${get('second')}`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts = [line.substring(0, 75)];
  for (let pos = 75; pos < line.length; pos += 74) {
    parts.push(' ' + line.substring(pos, pos + 74));
  }
  return parts.join('\r\n');
}

function buildICalendar(p: {
  uid: string; organizer: string; organizerName: string;
  attendeeEmail: string; attendeeName: string; subject: string;
  description: string; start: string; end: string; timeZone: string;
  location: string; showAs: string;
}): string {
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const busyStatus = p.showAs === 'oof' ? 'OOF' : p.showAs === 'free' ? 'FREE' : 'BUSY';

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Autoplanner//ShiftManager//EN',
    'METHOD:REQUEST',
    'CALSCALE:GREGORIAN',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Zurich',
    'BEGIN:STANDARD',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${p.uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=${p.timeZone}:${formatICalDate(p.start, p.timeZone)}`,
    `DTEND;TZID=${p.timeZone}:${formatICalDate(p.end, p.timeZone)}`,
    foldLine(`SUMMARY:${p.subject}`),
    foldLine(`DESCRIPTION:${stripHtml(p.description)}`),
    `ORGANIZER;CN=${p.organizerName}:mailto:${p.organizer}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${p.attendeeName}:mailto:${p.attendeeEmail}`,
    ...(p.location ? [`LOCATION:${p.location}`] : []),
    `TRANSP:${p.showAs === 'free' ? 'TRANSPARENT' : 'OPAQUE'}`,
    'SEQUENCE:0',
    'STATUS:CONFIRMED',
    `X-MICROSOFT-CDO-BUSYSTATUS:${busyStatus}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function buildMimeMessage(from: string, fromName: string, to: string, toName: string, subject: string, htmlBody: string, ical: string): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  return [
    `From: "${fromName}" <${from}>`,
    `To: "${toName}" <${to}>`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    htmlBody,
    '',
    `--${boundary}`,
    'Content-Type: text/calendar; charset="utf-8"; method=REQUEST',
    'Content-Transfer-Encoding: 7bit',
    '',
    ical,
    '',
    `--${boundary}--`,
  ].join('\r\n');
}

// POST - Create an Outlook event / send meeting invitation
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const graphToken = getGraphToken(request);
    if (!graphToken) {
      return NextResponse.json({ error: 'Missing Graph access token' }, { status: 401 });
    }

    const { mailbox, event } = await request.json();
    if (!mailbox || !event) {
      return NextResponse.json({ error: 'Missing mailbox or event data' }, { status: 400 });
    }

    // Personal calendar: simple Calendar API
    if (mailbox === 'me') {
      const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${graphToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return NextResponse.json(
          { error: 'Failed to create Outlook event', graphError: err?.error?.message || `HTTP ${res.status}` },
          { status: res.status }
        );
      }

      const created = await res.json();
      return NextResponse.json({ success: true, eventId: created.id, organizer: created.organizer?.emailAddress?.address || 'me' });
    }

    // Shared mailbox: MIME sendMail + Calendar API for tracking
    const attendee = event.attendees?.[0];
    if (!attendee?.emailAddress?.address) {
      return NextResponse.json({ error: 'Missing attendee information' }, { status: 400 });
    }

    const domain = mailbox.split('@')[1] || 'autoplanner.local';
    const uid = generateUID(domain);
    const mailboxName = mailbox.split('@')[0] || mailbox;
    const subject = event.subject || 'Shift Assignment';
    const htmlBody = event.body?.content || '<p>Shift assignment</p>';
    const startDT = event.start?.dateTime || new Date().toISOString();
    const endDT = event.end?.dateTime || new Date().toISOString();
    const timeZone = event.start?.timeZone || 'Europe/Zurich';

    // 1) Send MIME meeting invitation FROM the shared mailbox (organizer = shared mailbox)
    const ical = buildICalendar({
      uid, organizer: mailbox, organizerName: mailboxName,
      attendeeEmail: attendee.emailAddress.address,
      attendeeName: attendee.emailAddress.name || attendee.emailAddress.address,
      subject, description: htmlBody, start: startDT, end: endDT, timeZone,
      location: event.location?.displayName || '',
      showAs: event.showAs || 'busy',
    });

    const mime = buildMimeMessage(
      mailbox, mailboxName,
      attendee.emailAddress.address, attendee.emailAddress.name || attendee.emailAddress.address,
      subject, htmlBody, ical
    );

    const sendRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/sendMail`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${graphToken}`, 'Content-Type': 'text/plain' },
        body: Buffer.from(mime, 'utf-8').toString('base64'),
      }
    );

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      let msg = `HTTP ${sendRes.status}`;
      try { msg = JSON.parse(errText)?.error?.message || msg; } catch {}
      return NextResponse.json(
        { error: 'Failed to send meeting invitation', graphError: msg },
        { status: sendRes.status }
      );
    }

    // 2) Create tracking event on shared mailbox calendar WITH attendees
    //    Include attendee name in subject + keep attendees as "required" for visibility
    //    This sends a 2nd invitation but Outlook merges it with the MIME one
    const attendeeName = attendee.emailAddress.name || attendee.emailAddress.address.split('@')[0];
    const trackingEvent = {
      ...event,
      subject: `${subject} - ${attendeeName}`,
      isReminderOn: false,
    };
    let eventId = '';

    try {
      const calRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/calendar/events`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${graphToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(trackingEvent),
        }
      );
      if (calRes.ok) {
        eventId = (await calRes.json()).id;
      }
    } catch {
      // Tracking event creation failed, invitation was still sent
    }

    return NextResponse.json({
      success: true,
      eventId: eventId || `mime-uid:${uid}`,
      organizer: mailbox,
    });

  } catch {
    return NextResponse.json({ error: 'Failed to send Outlook event' }, { status: 500 });
  }
}

// DELETE - Remove an Outlook event from the shared mailbox calendar
// For personal calendar: uses cancel (notifies attendees)
// For shared mailbox: deletes the tracking event (no attendees to notify)
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const graphToken = getGraphToken(request);
    if (!graphToken) {
      return NextResponse.json({ error: 'Missing Graph access token' }, { status: 401 });
    }

    const { mailbox, eventId } = await request.json();
    if (!mailbox || !eventId) {
      return NextResponse.json({ error: 'Missing mailbox or eventId' }, { status: 400 });
    }

    if (eventId.startsWith('mime-uid:')) {
      return NextResponse.json({ success: true, warning: 'No Graph event ID for deletion' });
    }

    if (mailbox === 'me') {
      // Personal calendar: cancel notifies attendees, then removes event
      const cancelRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/events/${eventId}/cancel`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${graphToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment: 'Shift cancelled' }),
        }
      );
      if (!cancelRes.ok && cancelRes.status !== 202) {
        await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
          method: 'DELETE', headers: { 'Authorization': `Bearer ${graphToken}` }
        });
      }
      return NextResponse.json({ success: true });
    }

    // Shared mailbox: just delete the tracking event (it has no attendees)
    const eventUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/calendar/events/${eventId}`;
    const delRes = await fetch(eventUrl, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${graphToken}` }
    });

    if (!delRes.ok && delRes.status !== 204) {
      return NextResponse.json({ error: 'Failed to delete Outlook event' }, { status: delRes.status });
    }

    return NextResponse.json({ success: true });

  } catch {
    return NextResponse.json({ error: 'Failed to delete Outlook event' }, { status: 500 });
  }
}
