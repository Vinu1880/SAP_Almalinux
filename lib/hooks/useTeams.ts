// lib/hooks/useTeams.ts

import { useState, useEffect } from 'react';
import { useAuthFetch, useAuthReady } from './useAuthFetch';

export function useTeams() {
  const authFetch = useAuthFetch();
  const isReady = useAuthReady();
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const response = await authFetch('/api/teams');
      if (!response.ok) throw new Error('Failed to fetch teams');
      const data = await response.json();
      setTeams(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching teams');
    } finally {
      setLoading(false);
    }
  };

  const createTeam = async (teamData: any) => {
    try {
      const response = await authFetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create team');
      }
      
      const newTeam = await response.json();
      setTeams(prev => [...prev, newTeam]);
      return newTeam;
    } catch (err) {
      throw err;
    }
  };

  const updateTeam = async (id: string, teamData: any) => {
    try {
      const response = await authFetch(`/api/teams/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update team');
      }
      
      const updatedTeam = await response.json();
      setTeams(prev => prev.map(t => t.id === id ? updatedTeam : t));
      return updatedTeam;
    } catch (err) {
      throw err;
    }
  };

  const deleteTeam = async (id: string) => {
    try {
      const response = await authFetch(`/api/teams/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete team');
      }
      
      setTeams(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    if (isReady) {
      fetchTeams();
    }
  }, [isReady]);

  return {
    teams,
    loading,
    error,
    createTeam,
    updateTeam,
    deleteTeam,
    refetch: fetchTeams
  };
}