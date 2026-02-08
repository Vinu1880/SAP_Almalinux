'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { graphConfig } from '@/lib/msalConfig';

interface CalendarEvent {
  id: string;
  subject: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName: string;
  };
  attendees?: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
}

interface UserProfile {
  displayName: string;
  mail: string;
  userPrincipalName: string;
  id: string;
}

/**
 * Hook personnalisé pour interagir avec Microsoft Graph API
 * Permet d'accéder aux calendriers et informations utilisateur
 */
export const useGraphAPI = () => {
  const { getAccessToken, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Effectue un appel à Microsoft Graph API
   */
  const callGraphAPI = useCallback(
    async <T,>(endpoint: string, options: RequestInit = {}): Promise<T | null> => {
      if (!isAuthenticated) {
        setError('Utilisateur non authentifié');
        return null;
      }

      try {
        setIsLoading(true);
        setError(null);

        const token = await getAccessToken();
        if (!token) {
          throw new Error('Impossible d\'obtenir le token d\'accès');
        }

        const response = await fetch(endpoint, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data as T;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
        setError(errorMessage);
        console.error('Erreur lors de l\'appel à Graph API:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated, getAccessToken]
  );

  /**
   * Récupère les informations du profil utilisateur
   */
  const getUserProfile = useCallback(async (): Promise<UserProfile | null> => {
    return callGraphAPI<UserProfile>(graphConfig.graphMeEndpoint);
  }, [callGraphAPI]);

  /**
   * Récupère les événements du calendrier
   * @param startDate - Date de début (optionnel)
   * @param endDate - Date de fin (optionnel)
   */
  const getCalendarEvents = useCallback(
    async (startDate?: string, endDate?: string): Promise<CalendarEvent[] | null> => {
      let endpoint = graphConfig.graphEventsEndpoint;

      // Ajouter des filtres si des dates sont fournies
      if (startDate && endDate) {
        const filter = `start/dateTime ge '${startDate}' and end/dateTime le '${endDate}'`;
        endpoint += `?$filter=${encodeURIComponent(filter)}&$orderby=start/dateTime`;
      } else {
        // Par défaut, trier par date de début
        endpoint += '?$orderby=start/dateTime';
      }

      const response = await callGraphAPI<{ value: CalendarEvent[] }>(endpoint);
      return response?.value || null;
    },
    [callGraphAPI]
  );

  /**
   * Récupère les informations du calendrier principal
   */
  const getCalendar = useCallback(async () => {
    return callGraphAPI(graphConfig.graphCalendarEndpoint);
  }, [callGraphAPI]);

  /**
   * Crée un nouvel événement dans le calendrier
   */
  const createCalendarEvent = useCallback(
    async (event: Partial<CalendarEvent>): Promise<CalendarEvent | null> => {
      return callGraphAPI<CalendarEvent>(graphConfig.graphEventsEndpoint, {
        method: 'POST',
        body: JSON.stringify(event),
      });
    },
    [callGraphAPI]
  );

  /**
   * Met à jour un événement existant
   */
  const updateCalendarEvent = useCallback(
    async (eventId: string, event: Partial<CalendarEvent>): Promise<CalendarEvent | null> => {
      return callGraphAPI<CalendarEvent>(`${graphConfig.graphEventsEndpoint}/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify(event),
      });
    },
    [callGraphAPI]
  );

  /**
   * Supprime un événement du calendrier
   */
  const deleteCalendarEvent = useCallback(
    async (eventId: string): Promise<boolean> => {
      const response = await callGraphAPI(`${graphConfig.graphEventsEndpoint}/${eventId}`, {
        method: 'DELETE',
      });
      return response !== null;
    },
    [callGraphAPI]
  );

  return {
    // État
    isLoading,
    error,

    // Méthodes utilisateur
    getUserProfile,

    // Méthodes calendrier
    getCalendar,
    getCalendarEvents,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,

    // Méthode générique pour les appels personnalisés
    callGraphAPI,
  };
};
