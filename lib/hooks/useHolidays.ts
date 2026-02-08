// lib/hooks/useHolidays.ts

import { useState, useEffect, useCallback } from 'react';
import { useAuthFetch } from './useAuthFetch';

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


const isUserOnHoliday = useCallback((userLocation: string, date: string): boolean => {
  console.log(`\n=== isUserOnHoliday CHECK ===`);
  console.log(`User location: "${userLocation}"`);
  console.log(`Date to check: ${date}`);
  console.log(`Total holidays in memory: ${holidays.length}`);

  // Trouver les jours fériés pour cette date
  const dateHolidays = holidays.filter(h => {
    // Extract just the date part without timezone conversion
    // h.date can be either "2025-10-15" or "2025-10-15T00:00:00.000Z"
    // We want to compare just "2025-10-15" with the input date
    let holidayDate = h.date;
    if (typeof holidayDate === 'string') {
      holidayDate = holidayDate.split('T')[0]; // Extract YYYY-MM-DD part
    } else {
      // If it's a Date object, convert carefully
      holidayDate = new Date(holidayDate).toISOString().split('T')[0];
    }
    const match = holidayDate === date;
    if (match) {
      console.log(`  Found holiday: ${h.name} (${holidayDate}) for cantons: ${h.cantons.join(', ')}`);
    }
    return match;
  });

  console.log(`Holidays found for ${date}: ${dateHolidays.length}`);
  
  if (dateHolidays.length === 0) {
    console.log(`✅ No holidays for this date - User CAN work`);
    console.log(`=============================\n`);
    return false;
  }

  // Vérifier si l'utilisateur est concerné
  const isOnHoliday = dateHolidays.some(holiday => {
    console.log(`  Checking holiday: ${holiday.name}`);
    console.log(`    Holiday cantons: ${holiday.cantons.join(', ')}`);
    
    // Si c'est un jour férié pour tous les cantons
    if (holiday.cantons.includes('ALL')) {
      console.log(`    ✅ Holiday is for ALL cantons`);
      return true;
    }
    
    // Si l'utilisateur n'a pas de canton
    if (!userLocation || userLocation === '') {
      console.log(`    ⚠️ User has no location`);
      if (holiday.type === 'FEDERAL') {
        console.log(`    ✅ Holiday is FEDERAL - applies to user`);
        return true;
      }
      console.log(`    ❌ Holiday is not FEDERAL - does not apply`);
      return false;
    }
    
    // Normaliser le canton de l'utilisateur
    const userCanton = getUserCantonFromLocation(userLocation);
    console.log(`    User canton normalized: "${userCanton}"`);
    
    // Vérifier si le canton correspond
    const matches = holiday.cantons.includes(userCanton);
    console.log(`    ${matches ? '✅' : '❌'} Canton ${userCanton} ${matches ? 'IS' : 'IS NOT'} in holiday cantons`);
    
    return matches;
  });
  
  console.log(`FINAL RESULT: User ${isOnHoliday ? 'CANNOT' : 'CAN'} work on ${date}`);
  console.log(`=============================\n`);
  
  return isOnHoliday;
}, [holidays]);

  const getUserCantonFromLocation = (location: string): string => {
  // Les utilisateurs ont maintenant directement le code canton (VD, BE, ZH)
  // Si la valeur est vide ou null, retourner BE par défaut
  if (!location || typeof location !== 'string') {
    return 'BE';
  }
  
  // Si c'est déjà un code canton valide, le retourner directement EN MAJUSCULES
  const upperLocation = location.toUpperCase();
  if (['VD', 'BE', 'ZH'].includes(upperLocation)) {
    return upperLocation;
  }
  
  // Sinon retourner BE par défaut
  return 'BE';
};

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

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