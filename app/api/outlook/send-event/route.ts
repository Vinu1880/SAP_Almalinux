// app/api/outlook/send-event/route.ts
// Server-side route that creates Outlook events using application permissions
// so the organizer is the shared mailbox (not the logged-in admin user)

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rateLimit';

// Get application-level access token using client credentials
async function getAppAccessToken(): Promise<string> {
  const clientId = process.env.AZURE_AD_CLIENT_ID!;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET!;
  const tenantId = process.env.AZURE_AD_TENANT_ID!;

  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        scope: 'https://graph.microsoft.com/.default',
        client_secret: clientSecret,
        grant_type: 'client_credentials'
      })
    }
  );

  if (!tokenResponse.ok) {
    const err = await tokenResponse.text();
    throw new Error(`Failed to get app access token: ${err}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// POST - Create an Outlook event via the shared mailbox using application permissions
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const rl = checkRateLimit(getClientIdentifier(request), RATE_LIMITS.write);
  if (rl) return rl;

  try {
    const body = await request.json();
    const { mailbox, event } = body;

    if (!mailbox || !event) {
      return NextResponse.json(
        { error: 'Missing mailbox or event data' },
        { status: 400 }
      );
    }

    const accessToken = await getAppAccessToken();

    // Use /users/{mailbox}/events so the organizer IS the shared mailbox
    const graphUrl = `https://graph.microsoft.com/v1.0/users/${mailbox}/events`;

    const outlookResponse = await fetch(graphUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
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
    const body = await request.json();
    const { mailbox, eventId } = body;

    if (!mailbox || !eventId) {
      return NextResponse.json(
        { error: 'Missing mailbox or eventId' },
        { status: 400 }
      );
    }

    const accessToken = await getAppAccessToken();

    const graphUrl = `https://graph.microsoft.com/v1.0/users/${mailbox}/events/${eventId}`;

    const deleteResponse = await fetch(graphUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
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
