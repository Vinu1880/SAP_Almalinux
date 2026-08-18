'use client';

// Browser-side maintenance: audit-log cleanup (no server equivalent) and a
// localStorage-driven backup kept as a fallback. The authoritative backup now
// runs server-side in lib/backupScheduler.ts; both guard against duplicates.
import React, { useEffect, useRef } from 'react';
import { useAuthFetch, useAuthReady } from '@/lib/hooks/useAuthFetch';

const LAST_BACKUP_KEY = 'lastAutoBackupTime';
const BACKUP_SCHEDULE_KEY = 'backupSchedule';
const LAST_LOG_CLEANUP_KEY = 'lastLogCleanupTime';

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
        }
      } catch (err) {
        console.error('[AutoBackup] Error:', err);
      } finally {
        backingUpRef.current = false;
      }
    };

    // Daily audit log cleanup (independent of backup schedule)
    const lastCleanup = localStorage.getItem(LAST_LOG_CLEANUP_KEY);
    const lastCleanupTime = lastCleanup ? parseInt(lastCleanup, 10) : 0;
    const hoursSinceCleanup = (Date.now() - lastCleanupTime) / (1000 * 60 * 60);
    if (hoursSinceCleanup >= 24) {
      authFetch('/api/audit-logs/cleanup', { method: 'DELETE' })
        .then(() => localStorage.setItem(LAST_LOG_CLEANUP_KEY, String(Date.now())))
        .catch(() => {});
    }

    checkAndBackup();
    const timer = setInterval(checkAndBackup, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [isReady, authFetch]);

  return <>{children}</>;
};
