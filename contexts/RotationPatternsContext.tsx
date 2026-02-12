// contexts/RotationPatternsContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface WeekPattern {
  [key: string]: string[];
}

interface RotationPattern {
  id: string;
  name: string;
  description?: string;
  weeks: WeekPattern[];
  cycleLength: number;
}

interface RotationPatternsContextType {
  patterns: RotationPattern[];
  addPattern: (pattern: RotationPattern) => Promise<void>;
  updatePattern: (pattern: RotationPattern) => Promise<void>;
  deletePattern: (id: string) => Promise<void>;
  getPattern: (id: string) => RotationPattern | undefined;
}

const RotationPatternsContext = createContext<RotationPatternsContextType | undefined>(undefined);

export function RotationPatternsProvider({ children }: { children: ReactNode }) {
  const [patterns, setPatterns] = useState<RotationPattern[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const { getAccessToken, isAuthenticated } = useAuth();

  const authFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = await getAccessToken();
    const headers = new Headers(options.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(url, { ...options, headers });
  }, [getAccessToken]);

  // Load patterns from DB on mount
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadPatterns = async () => {
      try {
        // Try to load from DB
        const response = await authFetch('/api/rotation-patterns');
        if (response.ok) {
          const dbPatterns = await response.json();

          // If DB is empty, migrate from localStorage
          if (dbPatterns.length === 0 && typeof window !== 'undefined') {
            const saved = localStorage.getItem('rotationPatterns');
            if (saved) {
              try {
                const localPatterns = JSON.parse(saved);

                // Save each pattern to DB
                for (const pattern of localPatterns) {
                  await authFetch('/api/rotation-patterns', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(pattern)
                  });
                }

                // Reload from DB after migration
                const migratedResponse = await authFetch('/api/rotation-patterns');
                if (migratedResponse.ok) {
                  const migratedPatterns = await migratedResponse.json();
                  setPatterns(migratedPatterns);

                  // Clean up localStorage after successful migration
                  localStorage.removeItem('rotationPatterns');
                }
              } catch (e) {
                console.error('Error migrating patterns:', e);
              }
            }
          } else {
            setPatterns(dbPatterns);
          }
        } else {
          console.error('Error loading patterns from DB');
        }
      } catch (error) {
        console.error('Error loading patterns:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    loadPatterns();
  }, [isAuthenticated, authFetch]);

  const addPattern = async (pattern: RotationPattern) => {
    try {
      // Save to DB
      const response = await authFetch('/api/rotation-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pattern)
      });

      if (response.ok) {
        const savedPattern = await response.json();
        setPatterns(prev => [...prev, savedPattern]);
      } else {
        console.error('Error saving pattern');
      }
    } catch (error) {
      console.error('Error adding pattern:', error);
    }
  };

  const updatePattern = async (pattern: RotationPattern) => {
    try {
      // Update in DB
      const response = await authFetch(`/api/rotation-patterns/${pattern.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pattern)
      });

      if (response.ok) {
        const updatedPattern = await response.json();
        setPatterns(prev => prev.map(p => p.id === pattern.id ? updatedPattern : p));
      } else {
        console.error('Error updating pattern');
      }
    } catch (error) {
      console.error('Error updating pattern:', error);
    }
  };

  const deletePattern = async (id: string) => {
    try {
      // Delete from DB
      const response = await authFetch(`/api/rotation-patterns/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setPatterns(prev => prev.filter(p => p.id !== id));
      } else {
        console.error('Error deleting pattern');
      }
    } catch (error) {
      console.error('Error deleting pattern:', error);
    }
  };

  const getPattern = (id: string) => {
    return patterns.find(p => p.id === id);
  };

  return (
    <RotationPatternsContext.Provider value={{ patterns, addPattern, updatePattern, deletePattern, getPattern }}>
      {children}
    </RotationPatternsContext.Provider>
  );
}

export function useRotationPatterns() {
  const context = useContext(RotationPatternsContext);
  if (context === undefined) {
    throw new Error('useRotationPatterns must be used within a RotationPatternsProvider');
  }
  return context;
}
