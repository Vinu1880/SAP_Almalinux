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
      // FIX: Send rotationConfig directly as a simple JSON object
      const dataToSend = { ...userData };

      if (userData.rotationConfig && userData.rotationConfig.patternId) {
        // Keep rotationConfig as-is - it's a simple JSON object
        dataToSend.rotationConfig = {
          patternId: userData.rotationConfig.patternId,
          allowedShiftTypes: userData.rotationConfig.allowedShiftTypes || []
        };
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

      // Refresh the list
      await fetchUsers();
      return result;
    } catch (err) {
      console.error('Error creating user:', err);
      throw err;
    }
  };

  const updateUser = async (id: string, userData: any) => {
    try {
      // FIX: Send rotationConfig directly as a simple JSON object
      const dataToSend = { ...userData };

      if (userData.rotationConfig !== undefined) {
        if (userData.rotationConfig && userData.rotationConfig.patternId) {
          // Keep rotationConfig as-is - it's a simple JSON object
          dataToSend.rotationConfig = {
            patternId: userData.rotationConfig.patternId,
            priority: userData.rotationConfig.priority || 'medium',
            allowedShiftTypes: userData.rotationConfig.allowedShiftTypes || []
          };
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

      // Refresh the list
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

      // Refresh the list
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
