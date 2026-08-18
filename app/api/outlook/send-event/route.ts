// Proxy for Outlook calendar events via delegated Graph token
// Requires: Calendars.ReadWrite.Shared + Exchange "Send As" / "Full Access"

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';

function getGraphToken(request: NextRequest): string | null {
  return request.headers.get('X-Graph-Token') || null;
}

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

    const body = await request.json();
    const { mailbox, event } = body;

    if (!mailbox || !event) {
      return NextResponse.json({ error: 'Missing mailbox or event data' }, { status: 400 });
    }

    const graphUrl = mailbox === 'me'
      ? 'https://graph.microsoft.com/v1.0/me/events'
      : `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/calendar/events`;

    const outlookResponse = await fetch(graphUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${graphToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });

    if (!outlookResponse.ok) {
      const errorBody = await outlookResponse.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: 'Failed to create Outlook event',
          graphError: errorBody?.error?.message || errorBody?.error?.code || `HTTP ${outlookResponse.status}`
        },
        { status: outlookResponse.status }
      );
    }

    const createdEvent = await outlookResponse.json();

    return NextResponse.json({
      success: true,
      eventId: createdEvent.id,
      organizer: createdEvent.organizer?.emailAddress?.address || mailbox
    });

  } catch {
    return NextResponse.json({ error: 'Failed to send Outlook event' }, { status: 500 });
  }
}

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

    const eventUrl = mailbox === 'me'
      ? `https://graph.microsoft.com/v1.0/me/events/${eventId}`
      : `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/calendar/events/${eventId}`;

    // Cancel sends notification to attendees; fall back to DELETE if cancel fails
    const cancelRes = await fetch(`${eventUrl}/cancel`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${graphToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: 'Shift cancelled' }),
    });

    if (!cancelRes.ok && cancelRes.status !== 202) {
      const delRes = await fetch(eventUrl, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${graphToken}` }
      });

      if (!delRes.ok && delRes.status !== 204 && mailbox !== 'me') {
        await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${graphToken}` }
        });
      }
    }

    return NextResponse.json({ success: true });

  } catch {
    return NextResponse.json({ error: 'Failed to delete Outlook event' }, { status: 500 });
  }
}
