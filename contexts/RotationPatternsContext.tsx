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

  // Charger les patterns depuis la DB au montage
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadPatterns = async () => {
      try {
        // Essayer de charger depuis la DB
        const response = await authFetch('/api/rotation-patterns');
        if (response.ok) {
          const dbPatterns = await response.json();

          // Si la DB est vide, migrer depuis localStorage
          if (dbPatterns.length === 0 && typeof window !== 'undefined') {
            const saved = localStorage.getItem('rotationPatterns');
            if (saved) {
              try {
                const localPatterns = JSON.parse(saved);
                console.log('🔄 Migration des patterns depuis localStorage vers DB...');

                // Sauvegarder chaque pattern dans la DB
                for (const pattern of localPatterns) {
                  await authFetch('/api/rotation-patterns', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(pattern)
                  });
                }

                // Recharger depuis la DB après migration
                const migratedResponse = await authFetch('/api/rotation-patterns');
                if (migratedResponse.ok) {
                  const migratedPatterns = await migratedResponse.json();
                  setPatterns(migratedPatterns);
                  console.log('✅ Migration réussie!');

                  // Nettoyer localStorage après migration réussie
                  localStorage.removeItem('rotationPatterns');
                }
              } catch (e) {
                console.error('❌ Erreur migration patterns:', e);
              }
            }
          } else {
            setPatterns(dbPatterns);
          }
        } else {
          console.error('❌ Erreur chargement patterns DB');
        }
      } catch (error) {
        console.error('❌ Erreur lors du chargement des patterns:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    loadPatterns();
  }, [isAuthenticated, authFetch]);

  const addPattern = async (pattern: RotationPattern) => {
    try {
      // Sauvegarder dans la DB
      const response = await authFetch('/api/rotation-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pattern)
      });

      if (response.ok) {
        const savedPattern = await response.json();
        setPatterns(prev => [...prev, savedPattern]);
        console.log('✅ Pattern ajouté à la DB:', savedPattern.name);
      } else {
        console.error('❌ Erreur sauvegarde pattern');
      }
    } catch (error) {
      console.error('❌ Erreur lors de l\'ajout du pattern:', error);
    }
  };

  const updatePattern = async (pattern: RotationPattern) => {
    try {
      // Mettre à jour dans la DB
      const response = await authFetch(`/api/rotation-patterns/${pattern.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pattern)
      });

      if (response.ok) {
        const updatedPattern = await response.json();
        setPatterns(prev => prev.map(p => p.id === pattern.id ? updatedPattern : p));
        console.log('✅ Pattern mis à jour dans la DB:', updatedPattern.name);
      } else {
        console.error('❌ Erreur mise à jour pattern');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour du pattern:', error);
    }
  };

  const deletePattern = async (id: string) => {
    try {
      // Supprimer de la DB
      const response = await authFetch(`/api/rotation-patterns/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setPatterns(prev => prev.filter(p => p.id !== id));
        console.log('✅ Pattern supprimé de la DB');
      } else {
        console.error('❌ Erreur suppression pattern');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la suppression du pattern:', error);
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