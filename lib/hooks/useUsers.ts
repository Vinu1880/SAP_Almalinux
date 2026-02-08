// lib/hooks/useUsers.ts
import { useState, useEffect } from 'react';
import { useAuthFetch, useAuthReady } from './useAuthFetch';

export function useUsers() {
  const authFetch = useAuthFetch();
  const isReady = useAuthReady();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUsers = async () => {
    try {
      const response = await authFetch('/api/users', {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch users');
      
      const data = await response.json();
      
      // Log pour debug - vérifier les données reçues
      console.log('Users fetched from API:', data.map((u: any) => ({
        name: `${u.firstName} ${u.lastName}`,
        rotationConfig: u.rotationConfig,
        hasValidRotation: !!(u.rotationConfig && u.rotationConfig.patternId)
      })));
      
      setUsers(data);
      setError(null);
    } catch (err) {
      console.error('Error in useUsers fetchUsers:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (userData: any) => {
    try {
      console.log('Creating user with data (hook):', userData);
      
      // CORRECTION: Envoyer rotationConfig directement comme objet JSON simple
      const dataToSend = { ...userData };
      
      if (userData.rotationConfig && userData.rotationConfig.patternId) {
        // Garder rotationConfig tel quel - c'est un objet JSON simple
        dataToSend.rotationConfig = {
          patternId: userData.rotationConfig.patternId,
          priority: userData.rotationConfig.priority || 'medium',
          allowedShiftTypes: userData.rotationConfig.allowedShiftTypes || []
        };
        console.log('Sending rotation config:', dataToSend.rotationConfig);
      } else {
        dataToSend.rotationConfig = null;
      }

      const response = await authFetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create user');
      }
      
      const result = await response.json();
      console.log('User created successfully:', result);
      
      // Rafraîchir la liste
      await fetchUsers();
      return result;
    } catch (err) {
      console.error('Error creating user:', err);
      throw err;
    }
  };

  const updateUser = async (id: string, userData: any) => {
    try {
      console.log('Updating user with data (hook):', userData);
      
      // CORRECTION: Envoyer rotationConfig directement comme objet JSON simple
      const dataToSend = { ...userData };
      
      if (userData.rotationConfig !== undefined) {
        if (userData.rotationConfig && userData.rotationConfig.patternId) {
          // Garder rotationConfig tel quel - c'est un objet JSON simple
          dataToSend.rotationConfig = {
            patternId: userData.rotationConfig.patternId,
            priority: userData.rotationConfig.priority || 'medium',
            allowedShiftTypes: userData.rotationConfig.allowedShiftTypes || []
          };
          console.log('Sending rotation config for update:', dataToSend.rotationConfig);
        } else {
          dataToSend.rotationConfig = null;
        }
      }

      const response = await authFetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user');
      }
      
      const result = await response.json();
      console.log('User updated successfully:', result);
      
      // Rafraîchir la liste
      await fetchUsers();
      return result;
    } catch (err) {
      console.error('Error updating user:', err);
      throw err;
    }
  };

  const deleteUser = async (id: string) => {
    try {
      const response = await authFetch(`/api/users/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete user');
      }
      
      // Rafraîchir la liste
      await fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      throw err;
    }
  };

  useEffect(() => {
    if (isReady) {
      fetchUsers();
    }
  }, [isReady]);

  return {
    users,
    loading,
    error,
    createUser,
    updateUser,
    deleteUser,
    refetch: fetchUsers,
  };
}