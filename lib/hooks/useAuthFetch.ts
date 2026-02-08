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

      const headers = new Headers(options.headers);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      return fetch(url, {
        ...options,
        headers,
      });
    },
    [getAccessToken]
  );

  return authFetch;
}
