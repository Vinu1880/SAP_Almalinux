import { useState, useEffect, useCallback } from 'react';
import { useAuthFetch, useAuthReady } from './useAuthFetch';

interface Pikett {
  id: string;
  name: string;
  description?: string;
  teamId: string;
  team?: any;
  startWeek: string;
  endWeek?: string;
  userId?: string | null;
  includedUserIds: string[];
  excludedUserIds: string[];
  color: string;
  status: string;
  is24_7: boolean;
  daysOfWeek?: number[];
}

export function usePiketts() {
  const authFetch = useAuthFetch();
  const isReady = useAuthReady();
  const [piketts, setPiketts] = useState<Pikett[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPiketts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authFetch('/api/piketts');
      if (!response.ok) throw new Error('Failed to fetch piketts');
      const data = await response.json();
      setPiketts(data);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const createPikett = useCallback(async (pikettData: Omit<Pikett, 'id'>) => {
    try {
      const response = await authFetch('/api/piketts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pikettData)
      });
      
      if (!response.ok) throw new Error('Failed to create pikett');
      const newPikett = await response.json();
      setPiketts(prev => [...prev, newPikett]);
      
      return newPikett;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create pikett');
      throw err;
    }
  }, []);

  const updatePikett = useCallback(async (id: string, pikettData: Partial<Pikett>) => {
    try {
      const response = await authFetch(`/api/piketts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pikettData)
      });
      
      if (!response.ok) throw new Error('Failed to update pikett');
      const updatedPikett = await response.json();
      
      setPiketts(prev => prev.map(p => 
        p.id === id ? updatedPikett : p
      ));
      
      return updatedPikett;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update pikett');
      throw err;
    }
  }, []);

  const deletePikett = useCallback(async (id: string) => {
    try {
      const response = await authFetch(`/api/piketts/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to delete pikett');
      
      setPiketts(prev => prev.filter(p => p.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pikett');
      throw err;
    }
  }, []);

  useEffect(() => {
    if (isReady) {
      fetchPiketts();
    }
  }, [isReady, fetchPiketts]);

  return {
    piketts,
    loading,
    error,
    createPikett,
    updatePikett,
    deletePikett,
    refetch: fetchPiketts
  };
}