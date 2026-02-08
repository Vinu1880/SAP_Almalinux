// /lib/hooks/useRotationProfiles.ts

import { useState, useEffect } from 'react';
import { useAuthFetch } from './useAuthFetch';

interface RotationProfile {
  id: string;
  userId: string;
  patternId: string;
  isActive: boolean;
  startDate: string;
  endDate?: string;
  allowedShiftTypes: string[];
  priority: 'high' | 'medium' | 'low';
  notes?: string;
  pattern?: {
    id: string;
    name: string;
    description?: string;
    cycleLength: number;
    weeks: any[];
  };
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    displayName?: string;
  };
}

export const useRotationProfiles = () => {
  const authFetch = useAuthFetch();
  const [rotationProfiles, setRotationProfiles] = useState<RotationProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRotationProfiles = async () => {
    try {
      const response = await authFetch('/api/rotation-profiles');
      if (!response.ok) throw new Error('Failed to fetch rotation profiles');
      
      const data = await response.json();
      setRotationProfiles(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching rotation profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  const createRotationProfile = async (profileData: Partial<RotationProfile>) => {
    try {
      const response = await authFetch('/api/rotation-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      });
      
      if (!response.ok) throw new Error('Failed to create rotation profile');
      
      const newProfile = await response.json();
      setRotationProfiles(prev => [...prev, newProfile]);
      return newProfile;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const updateRotationProfile = async (id: string, profileData: Partial<RotationProfile>) => {
    try {
      const response = await authFetch(`/api/rotation-profiles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      });
      
      if (!response.ok) throw new Error('Failed to update rotation profile');
      
      const updatedProfile = await response.json();
      setRotationProfiles(prev => 
        prev.map(p => p.id === id ? updatedProfile : p)
      );
      return updatedProfile;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const deleteRotationProfile = async (id: string) => {
    try {
      const response = await authFetch(`/api/rotation-profiles/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to delete rotation profile');
      
      setRotationProfiles(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchRotationProfiles();
  }, []);

  return {
    rotationProfiles,
    loading,
    error,
    createRotationProfile,
    updateRotationProfile,
    deleteRotationProfile,
    refetch: fetchRotationProfiles
  };
};