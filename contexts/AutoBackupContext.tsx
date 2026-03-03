'use client';

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useAuthFetch, useAuthReady } from '@/lib/hooks/useAuthFetch';

interface AutoBackupContextType {
  // placeholder for future use
}

const AutoBackupContext = createContext<AutoBackupContextType | undefined>(undefined);

const LAST_BACKUP_KEY = 'lastAutoBackupTime';
const BACKUP_SCHEDULE_KEY = 'backupSchedule';

function shouldBackupNow(schedule: any): boolean {
  const now = new Date();
  const [targetHour, targetMin] = (schedule.hour || '02:00').split(':').map(Number);
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();

  // Only trigger within the target hour window (±30 min)
  const targetMinutes = targetHour * 60 + targetMin;
  const currentMinutes = currentHour * 60 + currentMin;
  if (Math.abs(currentMinutes - targetMinutes) > 30) return false;

  if (schedule.frequency === 'weekly') {
    if (now.getDay() !== schedule.dayOfWeek) return false;
  }

  if (schedule.frequency === 'monthly') {
    if (now.getDate() !== schedule.dayOfMonth) return false;
  }

  return true;
}

export const AutoBackupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authFetch = useAuthFetch();
  const isReady = useAuthReady();
  const backingUpRef = useRef(false);

  useEffect(() => {
    if (!isReady) return;

    const checkAndBackup = async () => {
      if (backingUpRef.current) return;

      const saved = localStorage.getItem(BACKUP_SCHEDULE_KEY);
      if (!saved) return;

      const schedule = JSON.parse(saved);
      if (!schedule.enabled) return;

      // Check if we should backup now based on frequency/day/time
      if (!shouldBackupNow(schedule)) return;

      // Check if we already backed up today (prevent duplicates)
      const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
      const lastTime = lastBackup ? parseInt(lastBackup, 10) : 0;
      const now = Date.now();
      const hoursSinceLast = (now - lastTime) / (1000 * 60 * 60);

      // Minimum 12 hours between auto-backups to avoid duplicates
      if (hoursSinceLast < 12) return;

      backingUpRef.current = true;
      try {
        const res = await authFetch('/api/backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ maxBackups: schedule.maxBackups > 0 ? schedule.maxBackups : 0 }),
        });

        if (res.ok) {
          localStorage.setItem(LAST_BACKUP_KEY, String(now));
          // Cleanup audit logs older than 90 days
          authFetch('/api/audit-logs/cleanup', { method: 'DELETE' }).catch(() => {});
        }
      } catch (err) {
        console.error('[AutoBackup] Error:', err);
      } finally {
        backingUpRef.current = false;
      }
    };

    // Check on mount
    checkAndBackup();

    // Check every 10 minutes
    const timer = setInterval(checkAndBackup, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [isReady, authFetch]);

  return (
    <AutoBackupContext.Provider value={{}}>
      {children}
    </AutoBackupContext.Provider>
  );
};

export const useAutoBackup = () => {
  const ctx = useContext(AutoBackupContext);
  if (!ctx) throw new Error('useAutoBackup must be used within AutoBackupProvider');
  return ctx;
};
