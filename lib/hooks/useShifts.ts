// lib/hooks/useShifts.ts

import { useState, useEffect } from 'react';
import { useAuthFetch, useAuthReady } from './useAuthFetch';

export interface Shift {
  id: string;
  name: string;
  description: string | null;
  startTime: string;
  endTime: string;
  daysOfWeek?: number[];
  teamId: string;
  team: {
    id: string;
    name: string;
  };
  membersRequired: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'ACTIVE' | 'INACTIVE';
  color: string;
  usageCount: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function useShifts() {
  const authFetch = useAuthFetch();
  const isReady = useAuthReady();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const response = await authFetch('/api/shifts');
      if (!response.ok) throw new Error('Failed to fetch shifts');
      const data = await response.json();
      setShifts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const createShift = async (shiftData: Partial<Shift>) => {
    try {
      const response = await authFetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shiftData)
      });
      if (!response.ok) throw new Error('Failed to create shift');
      const newShift = await response.json();
      setShifts([...shifts, newShift]);
      return newShift;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    }
  };

  const updateShift = async (id: string, shiftData: Partial<Shift>) => {
    try {
      const response = await authFetch(`/api/shifts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shiftData)
      });
      if (!response.ok) throw new Error('Failed to update shift');
      const updatedShift = await response.json();
      setShifts(shifts.map(s => s.id === id ? updatedShift : s));
      return updatedShift;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    }
  };

  const deleteShift = async (id: string) => {
    try {
      const response = await authFetch(`/api/shifts/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete shift');
      setShifts(shifts.filter(s => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    }
  };

  useEffect(() => {
    if (isReady) {
      fetchShifts();
    }
  }, [isReady]);

  return {
    shifts,
    loading,
    error,
    refetch: fetchShifts,
    createShift,
    updateShift,
    deleteShift
  };
}