// lib/hooks/usePikettAssignments.ts

import { useState, useEffect, useCallback } from 'react';
import { useAuthFetch, useAuthReady } from './useAuthFetch';

export interface PikettAssignment {
  id: string;
  date: Date;
  status: 'PENDING' | 'TENTATIVE' | 'ACCEPTED' | 'REFUSED' | 'CANCELLED';
  reason?: string;
  respondedAt?: Date;
  outlookEventId?: string;
  resent?: boolean;
  resentAt?: Date;
  resentFromId?: string;
  pikettId: string;
  pikett: {
    id: string;
    name: string;
    description?: string;
    startWeek: string;
    endWeek?: string;
    color: string;
    is24_7: boolean;
    teamId: string;
    team: {
      id: string;
      name: string;
      color: string;
    };
  };
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    teamId?: string;
    team?: {
      id: string;
      name: string;
      color: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface PikettAssignmentStats {
  accepted: number;
  refused: number;
  pending: number;
  tentative: number;
  cancelled: number;
  total: number;
  resent: number;
  refusedNotResent: number;
}

export interface UserStats {
  userId: string;
  total: number;
  accepted: number;
  refused: number;
  pending: number;
  tentative: number;
  cancelled: number;
}

export interface TeamStats {
  teamId: string;
  total: number;
  accepted: number;
  refused: number;
  pending: number;
  tentative: number;
  cancelled: number;
}

interface UsePikettAssignmentsOptions {
  dateFilter?: '24h' | '7d' | '30d' | '90d' | '180d';
  teamId?: string;
  userId?: string;
  status?: 'PENDING' | 'TENTATIVE' | 'ACCEPTED' | 'REFUSED' | 'CANCELLED';
}

export function usePikettAssignments(options: UsePikettAssignmentsOptions = {}) {
  const authFetch = useAuthFetch();
  const isReady = useAuthReady();
  const [assignments, setAssignments] = useState<PikettAssignment[]>([]);
  const [stats, setStats] = useState<PikettAssignmentStats>({
    accepted: 0,
    refused: 0,
    pending: 0,
    tentative: 0,
    cancelled: 0,
    total: 0,
    resent: 0,
    refusedNotResent: 0,
  });
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options.dateFilter) params.append('dateFilter', options.dateFilter);
      if (options.teamId) params.append('teamId', options.teamId);
      if (options.userId) params.append('userId', options.userId);
      if (options.status) params.append('status', options.status);

      const response = await authFetch(`/api/pikett-assignments?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch pikett assignments');

      const data = await response.json();
      setAssignments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching pikett assignments:', err);
    } finally {
      setLoading(false);
    }
  }, [options.dateFilter, options.teamId, options.userId, options.status]);

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (options.dateFilter) params.append('dateFilter', options.dateFilter);
      if (options.teamId) params.append('teamId', options.teamId);

      const response = await authFetch(`/api/pikett-assignments/stats?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch pikett stats');

      const data = await response.json();
      setStats(data.stats);
      setUserStats(data.userStats);
      setTeamStats(data.teamStats);
    } catch (err) {
      console.error('Error fetching pikett stats:', err);
    }
  }, [options.dateFilter, options.teamId]);

  const createAssignments = async (assignmentsData: Array<{
    date: string;
    pikettId: string;
    userId: string;
    status?: 'PENDING' | 'TENTATIVE' | 'ACCEPTED' | 'REFUSED' | 'CANCELLED';
    reason?: string;
  }>) => {
    try {
      const response = await authFetch('/api/pikett-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: assignmentsData })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create pikett assignments');
      }

      const result = await response.json();

      await fetchAssignments();
      await fetchStats();

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  };

  const updateAssignment = async (id: string, updateData: {
    status?: 'PENDING' | 'TENTATIVE' | 'ACCEPTED' | 'REFUSED' | 'CANCELLED';
    reason?: string;
  }) => {
    try {
      const response = await authFetch(`/api/pikett-assignments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update pikett assignment');
      }

      const updated = await response.json();

      setAssignments(prev =>
        prev.map(a => a.id === id ? updated : a)
      );

      await fetchStats();

      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  };

  const deleteAssignment = async (id: string) => {
    try {
      const response = await authFetch(`/api/pikett-assignments/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete pikett assignment');
      }

      setAssignments(prev => prev.filter(a => a.id !== id));

      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  };

  const refresh = useCallback(async () => {
    await Promise.all([fetchAssignments(), fetchStats()]);
  }, [fetchAssignments, fetchStats]);

  useEffect(() => {
    if (isReady) {
      fetchAssignments();
      fetchStats();
    }
  }, [isReady, fetchAssignments, fetchStats]);

  return {
    assignments,
    stats,
    userStats,
    teamStats,
    loading,
    error,
    createAssignments,
    updateAssignment,
    deleteAssignment,
    refresh
  };
}
