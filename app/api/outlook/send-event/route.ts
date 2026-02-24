// app/api/outlook/send-event/route.ts
// Server-side proxy that creates/deletes Outlook events using the user's delegated Graph token
// The user must have Calendars.ReadWrite.Shared to create events on the shared mailbox
// With delegated + "Send As" permissions, the organizer will be the shared mailbox

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';

// Extract the Graph access token from the request header
function getGraphToken(request: NextRequest): string | null {
  const header = request.headers.get('X-Graph-Token');
  return header || null;
}

// POST - Create an Outlook event via the shared mailbox using delegated permissions
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const graphToken = getGraphToken(request);
    if (!graphToken) {
      return NextResponse.json(
        { error: 'Missing Graph access token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { mailbox, event } = body;

    if (!mailbox || !event) {
      return NextResponse.json(
        { error: 'Missing mailbox or event data' },
        { status: 400 }
      );
    }

    // Use /users/{mailbox}/events with delegated token
    // Requires Calendars.ReadWrite.Shared + "Send As" permission on the shared mailbox
    const graphUrl = `https://graph.microsoft.com/v1.0/users/${mailbox}/events`;

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

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to send Outlook event' },
      { status: 500 }
    );
  }
}

// DELETE - Delete an Outlook event from a mailbox
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const graphToken = getGraphToken(request);
    if (!graphToken) {
      return NextResponse.json(
        { error: 'Missing Graph access token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { mailbox, eventId } = body;

    if (!mailbox || !eventId) {
      return NextResponse.json(
        { error: 'Missing mailbox or eventId' },
        { status: 400 }
      );
    }

    const graphUrl = `https://graph.microsoft.com/v1.0/users/${mailbox}/events/${eventId}`;

    const deleteResponse = await fetch(graphUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${graphToken}`
      }
    });

    if (!deleteResponse.ok && deleteResponse.status !== 204) {
      return NextResponse.json(
        { error: 'Failed to delete Outlook event' },
        { status: deleteResponse.status }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete Outlook event' },
      { status: 500 }
    );
  }
}
