// lib/hooks/useAssignments.ts

import { useState, useEffect } from 'react';
import { useAuthFetch, useAuthReady } from './useAuthFetch';

export interface Assignment {
  id: string;
  date: Date;
  shiftId: string;
  userId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REFUSED' | 'CANCELLED';
  reason: string | null;
  shift: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    team: {
      name: string;
    };
  };
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export function useAssignments(filters?: {
  userId?: string;
  shiftId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}) {
  const authFetch = useAuthFetch();
  const isReady = useAuthReady();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters?.userId) params.append('userId', filters.userId);
      if (filters?.shiftId) params.append('shiftId', filters.shiftId);
      if (filters?.startDate) params.append('startDate', filters.startDate);
      if (filters?.endDate) params.append('endDate', filters.endDate);
      if (filters?.status) params.append('status', filters.status);
      
      const response = await authFetch(`/api/assignments?${params}`);
      if (!response.ok) throw new Error('Failed to fetch assignments');
      const data = await response.json();
      setAssignments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const createAssignments = async (shiftId: string, assignmentData: any[]) => {
    try {
      const response = await authFetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId, assignments: assignmentData })
      });
      if (!response.ok) throw new Error('Failed to create assignments');
      const result = await response.json();
      await fetchAssignments(); // Refresh the list
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    }
  };

  const updateAssignmentStatus = async (id: string, status: string, reason?: string) => {
    try {
      const response = await authFetch(`/api/assignments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason })
      });
      if (!response.ok) throw new Error('Failed to update assignment');
      const updatedAssignment = await response.json();
      setAssignments(assignments.map(a => a.id === id ? updatedAssignment : a));
      return updatedAssignment;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    }
  };

  const cancelAssignment = async (id: string) => {
    try {
      const response = await authFetch(`/api/assignments/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel assignment');
      }
      await fetchAssignments(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      throw err;
    }
  };

  useEffect(() => {
    if (isReady) {
      fetchAssignments();
    }
  }, [isReady, filters?.userId, filters?.shiftId, filters?.startDate, filters?.endDate, filters?.status]);

  return {
    assignments,
    loading,
    error,
    refetch: fetchAssignments,
    createAssignments,
    updateAssignmentStatus,
    cancelAssignment
  };
}