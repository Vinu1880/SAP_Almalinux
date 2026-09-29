'use client';

import { subjectWithCc } from '@/lib/ccInvite';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthFetch, useAuthReady } from '@/lib/hooks/useAuthFetch';

interface AutoSyncContextType {
  nextSyncIn: number;
  syncing: boolean;
  syncMessage: { type: 'success' | 'error'; text: string } | null;
  triggerSync: () => Promise<void>;
  clearSyncMessage: () => void;
}

const AutoSyncContext = createContext<AutoSyncContextType | undefined>(undefined);

const SYNC_INTERVAL = 15 * 60; // 15 minutes in seconds

export const AutoSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getAccessToken } = useAuth();
  const authFetch = useAuthFetch();
  const isReady = useAuthReady();
  const [nextSyncIn, setNextSyncIn] = useState(SYNC_INTERVAL);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const syncingRef = useRef(false);
  const syncPromiseRef = useRef<Promise<void> | null>(null);

  const clearSyncMessage = useCallback(() => setSyncMessage(null), []);

  const doSync = useCallback(async () => {
    // If already syncing, wait for the current sync to finish
    if (syncingRef.current && syncPromiseRef.current) {
      await syncPromiseRef.current;
      return;
    }

    syncingRef.current = true;
    setSyncing(true);
    setSyncMessage(null);

    const promise = (async () => {
      try {
        const graphToken = await getAccessToken();
        const res = await authFetch('/api/outlook/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(graphToken ? { 'X-Graph-Token': graphToken } : {})
          }
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || 'Sync failed');
        }

        const result = await res.json();

        // A copied person who declined has just been dropped from the row.
        // Their name still sits in the event subject on the shared calendar, so
        // the team reads them as involved — rewrite it. Only the browser holds
        // a delegated Graph token, which is why the server cannot do this.
        if (graphToken && Array.isArray(result.ccDeclines) && result.ccDeclines.length > 0) {
          for (const d of result.ccDeclines) {
            try {
              const holder = `${d.holder?.firstName || ''} ${d.holder?.lastName || ''}`.trim();
              const base = `${d.itemName || ''} - ${holder}`.trim();
              const subject = subjectWithCc(base, d.remainingCc || []);
              const changes: any = { subject };

              // The holder refused, so the copied people have to come off the
              // event itself — a subject rewrite alone would leave the slot
              // sitting in their calendar. Only the required attendee stays.
              if (d.dropAttendees && d.holder?.email) {
                changes.attendees = [{
                  emailAddress: { address: d.holder.email, name: holder },
                  type: 'required',
                }];
              }

              await authFetch('/api/outlook/send-event', {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Graph-Token': graphToken,
                },
                body: JSON.stringify({
                  mailbox: d.mailbox,
                  eventId: d.outlookEventId,
                  changes,
                }),
              });
            } catch {
              // Best effort: the row is already correct, only the calendar text lags.
            }
          }
        }

        setSyncMessage({ type: 'success', text: `Sync: ${result.updated || 0} updated` });
        setTimeout(() => setSyncMessage(null), 5000);

        // Mirror this year's absences once a day. The planner needs them to
        // compute availability over past months, and holidays do not change
        // often enough to justify scanning a full year every 15 minutes.
        if (graphToken) {
          const LAST_OOF_SYNC_KEY = 'lastOofSyncTime';
          const last = Number(localStorage.getItem(LAST_OOF_SYNC_KEY) || 0);
          if (Date.now() - last > 24 * 60 * 60 * 1000) {
            try {
              const oofRes = await authFetch('/api/out-of-office/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Graph-Token': graphToken },
              });
              // Only mark it done on success, so a failure retries next cycle.
              if (oofRes.ok) localStorage.setItem(LAST_OOF_SYNC_KEY, String(Date.now()));
            } catch {
              // Non-blocking: the shift sync above already succeeded.
            }
          }
        }
      } catch (err) {
        setSyncMessage({ type: 'error', text: err instanceof Error ? err.message : 'Sync error' });
        setTimeout(() => setSyncMessage(null), 10000);
      } finally {
        syncingRef.current = false;
        setSyncing(false);
        syncPromiseRef.current = null;
      }
    })();

    syncPromiseRef.current = promise;
    await promise;
  }, [getAccessToken, authFetch]);

  const triggerSync = useCallback(async () => {
    await doSync();
    setNextSyncIn(SYNC_INTERVAL);
  }, [doSync]);

  // Countdown + auto-sync
  useEffect(() => {
    if (!isReady) return;
    setNextSyncIn(SYNC_INTERVAL);
    const timer = setInterval(() => {
      setNextSyncIn(prev => {
        if (prev <= 1) {
          doSync();
          return SYNC_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isReady, doSync]);

  return (
    <AutoSyncContext.Provider value={{ nextSyncIn, syncing, syncMessage, triggerSync, clearSyncMessage }}>
      {children}
    </AutoSyncContext.Provider>
  );
};

export const useAutoSync = () => {
  const ctx = useContext(AutoSyncContext);
  if (!ctx) throw new Error('useAutoSync must be used within AutoSyncProvider');
  return ctx;
};
