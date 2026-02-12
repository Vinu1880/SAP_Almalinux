// lib/hooks/useHolidays.ts

import { useState, useEffect, useCallback } from 'react';
import { useAuthFetch, useAuthReady } from './useAuthFetch';

export interface Holiday {
  id: string;
  name: string;
  date: string; // Format YYYY-MM-DD
  cantons: string[];
  type: 'FEDERAL' | 'CANTONAL' | 'CUSTOM';
  recurring: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export function useHolidays(year?: number) {
  const authFetch = useAuthFetch();
  const isReady = useAuthReady();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHolidays = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (year) params.append('year', year.toString());
      
      const response = await authFetch(`/api/holidays?${params}`);
      if (!response.ok) throw new Error('Failed to fetch holidays');
      const data = await response.json();
      setHolidays(data);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }, [year]);

  const createHoliday = useCallback(async (holidayData: Omit<Holiday, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const response = await authFetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(holidayData)
      });
      
      if (!response.ok) throw new Error('Failed to create holiday');
      const newHoliday = await response.json();
      setHolidays(prev => [...prev, newHoliday]);
      
      return newHoliday;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
      throw err;
    }
  }, []);

  const updateHoliday = useCallback(async (id: string, holidayData: Partial<Holiday>) => {
    try {
      const response = await authFetch(`/api/holidays/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(holidayData)
      });
      
      if (!response.ok) throw new Error('Failed to update holiday');
      const updatedHoliday = await response.json();
      
      setHolidays(prev => prev.map(h => 
        h.id === id ? updatedHoliday : h
      ));
      
      return updatedHoliday;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
      throw err;
    }
  }, []);

  const deleteHoliday = useCallback(async (id: string) => {
    try {
      const response = await authFetch(`/api/holidays/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to delete holiday');
      
      setHolidays(prev => prev.filter(h => h.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
      throw err;
    }
  }, []);

  const importStandardHolidays = useCallback(async (year: number, cantons: string[]) => {
    try {
      const response = await authFetch('/api/holidays/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, cantons })
      });
      
      if (!response.ok) throw new Error('Failed to import holidays');
      const importedHolidays = await response.json();
      
      setHolidays(prev => [...prev, ...importedHolidays]);
      return importedHolidays;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'import');
      throw err;
    }
  }, []);


// Check if a user is on holiday for a given date based on their canton
const isUserOnHoliday = useCallback((userLocation: string, date: string): boolean => {
  // Find holidays matching the given date
  const dateHolidays = holidays.filter(h => {
    let holidayDate = h.date;
    if (typeof holidayDate === 'string') {
      holidayDate = holidayDate.split('T')[0];
    } else {
      holidayDate = new Date(holidayDate).toISOString().split('T')[0];
    }
    return holidayDate === date;
  });

  if (dateHolidays.length === 0) {
    return false;
  }

  // Check if any holiday applies to this user's canton
  const isOnHoliday = dateHolidays.some(holiday => {
    // Holiday applies to all cantons
    if (holiday.cantons.includes('ALL')) {
      return true;
    }

    // User has no location - only federal holidays apply
    if (!userLocation || userLocation === '') {
      return holiday.type === 'FEDERAL';
    }

    // Check if user's canton matches
    const userCanton = getUserCantonFromLocation(userLocation);
    return holiday.cantons.includes(userCanton);
  });

  return isOnHoliday;
}, [holidays]);

  // Map user location to canton code (VD, BE, ZH), defaults to BE
  const getUserCantonFromLocation = (location: string): string => {
  if (!location || typeof location !== 'string') {
    return 'BE';
  }

  const upperLocation = location.toUpperCase();
  if (['VD', 'BE', 'ZH'].includes(upperLocation)) {
    return upperLocation;
  }

  return 'BE';
};

  useEffect(() => {
    if (isReady) {
      fetchHolidays();
    }
  }, [isReady, fetchHolidays]);

  return {
    holidays,
    loading,
    error,
    createHoliday,
    updateHoliday,
    deleteHoliday,
    importStandardHolidays,
    isUserOnHoliday,
    refetch: fetchHolidays
  };
}