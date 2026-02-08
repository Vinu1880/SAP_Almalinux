import { NextRequest, NextResponse } from 'next/server';

export interface AuthUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

/**
 * Validates an Azure AD token by calling Microsoft Graph /me endpoint.
 * Returns the user profile if the token is valid, null otherwise.
 */
async function validateToken(request: NextRequest): Promise<AuthUser | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return null;
  }

  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return null;
    }

    const profile = await response.json();
    return {
      id: profile.id,
      displayName: profile.displayName,
      mail: profile.mail || profile.userPrincipalName,
      userPrincipalName: profile.userPrincipalName,
    };
  } catch {
    return null;
  }
}

/**
 * Middleware function to protect API routes.
 * Returns a 401 response if the token is invalid, or the user object if valid.
 */
export async function requireAuth(request: NextRequest): Promise<{ user: AuthUser } | NextResponse> {
  const user = await validateToken(request);

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return { user };
}
