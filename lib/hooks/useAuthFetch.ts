'use client';

import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Returns an authenticated fetch function that automatically
 * attaches the Azure AD Bearer token to all requests.
 */
export function useAuthFetch() {
  const { getAccessToken } = useAuth();

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const token = await getAccessToken();

      if (!token) {
        throw new Error('No authentication token available');
      }

      const headers = new Headers(options.headers);
      headers.set('Authorization', `Bearer ${token}`);

      return fetch(url, {
        ...options,
        headers,
      });
    },
    [getAccessToken]
  );

  return authFetch;
}

/**
 * Returns true when the user is authenticated and MSAL is ready.
 * Use this to guard initial data fetches in hooks.
 */
export function useAuthReady(): boolean {
  const { isAuthenticated, isLoading } = useAuth();
  return isAuthenticated && !isLoading;
}
