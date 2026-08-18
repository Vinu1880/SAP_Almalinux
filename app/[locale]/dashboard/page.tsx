'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useMemo } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navigation from '@/components/Navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  CheckCircle, XCircle, Clock3, TrendingUp, Users, Calendar, Filter,
  Download, RefreshCw, Loader2, Send, AlertCircle, Building2, X, Network,
  FilterX, ArrowUpDown, ArrowUp, ArrowDown, Trash2, AlertTriangle,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useShiftAssignments } from '@/lib/hooks/useShiftAssignments';
import { usePikettAssignments } from '@/lib/hooks/usePikettAssignments';
import { useUsers } from '@/lib/hooks/useUsers';
import { useTeams } from '@/lib/hooks/useTeams';
import { useHolidays } from '@/lib/hooks/useHolidays';
import { useShifts } from '@/lib/hooks/useShifts';
import { usePiketts } from '@/lib/hooks/usePiketts';
import { useAuthFetch, useAuthReady } from '@/lib/hooks/useAuthFetch';
import { useAuth } from '@/contexts/AuthContext';
import { useAutoSync } from '@/contexts/AutoSyncContext';

const DashboardPage = () => {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const authFetch = useAuthFetch();
  const isReady = useAuthReady();
  const { getAccessToken } = useAuth();
  const [dateFilter, setDateFilter] = useState<'7d' | '30d' | '90d' | '180d' | 'all'>('all');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedView, setSelectedView] = useState<'shifts' | 'users' | 'calendar'>('shifts');
  const [mode, setMode] = useState<'shifts' | 'pikett'>('shifts');
  const { nextSyncIn, syncing, syncMessage, triggerSync, clearSyncMessage } = useAutoSync();
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [resendingAssignment, setResendingAssignment] = useState<any | null>(null);
  const [selectedNewUser, setSelectedNewUser] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [deletingAssignment, setDeletingAssignment] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedShift, setSelectedShift] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [sortByDate, setSortByDate] = useState<'asc' | 'desc' | null>('asc');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const now = new Date();
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth());
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [calendarAssignments, setCalendarAssignments] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null);

  const resetFilters = () => {
    setSelectedUser('all');
    setSelectedShift('all');
    setSelectedStatus('all');
    setSelectedDate('');
    setCurrentPage(1);
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedUser, selectedShift, selectedStatus, selectedDate, dateFilter, selectedTeam]);

  React.useEffect(() => {
    resetFilters();
    setSelectedCalendarDay(null);
  }, [mode]);

  const shiftData = useShiftAssignments({
    dateFilter: dateFilter === 'all' ? undefined : dateFilter,
    teamId: selectedTeam === 'all' ? undefined : selectedTeam
  });

  const pikettData = usePikettAssignments({
    dateFilter: dateFilter === 'all' ? undefined : dateFilter,
    teamId: selectedTeam === 'all' ? undefined : selectedTeam
  });

  const { assignments, stats, userStats, teamStats, loading, error, refresh } =
    mode === 'shifts' ? shiftData : pikettData;

  const { users, loading: usersLoading } = useUsers();
  const { teams, loading: teamsLoading } = useTeams();

  const generateCalendarDays = (): (Date | null)[] => {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
    const startPadding = (firstDay.getDay() + 6) % 7; // Monday = 0
    const days: (Date | null)[] = Array(startPadding).fill(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(calendarYear, calendarMonth, d));
    }
    while (days.length % 7 !== 0) days.push(null);
    return days;
  };

  const calendarByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    calendarAssignments.forEach(a => {
      const key = new Date(a.date).toISOString().split('T')[0];
      (map[key] ||= []).push(a);
    });
    return map;
  }, [calendarAssignments]);

  const statusDotColor = (status: string) => {
    switch (status) {
      case 'ACCEPTED': return 'bg-green-500';
      case 'REFUSED': return 'bg-red-500';
      case 'PENDING': return 'bg-blue-500';
      case 'TENTATIVE': return 'bg-orange-500';
      case 'CANCELLED': return 'bg-gray-400';
      default: return 'bg-slate-300';
    }
  };

  const fetchCalendarAssignments = React.useCallback(async () => {
    setCalendarLoading(true);
    try {
      const firstDay = new Date(calendarYear, calendarMonth, 1);
      const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
      const startDate = firstDay.toISOString().split('T')[0];
      const endDate = lastDay.toISOString().split('T')[0];
      const params = new URLSearchParams({ startDate, endDate });
      if (selectedTeam !== 'all') params.append('teamId', selectedTeam);
      const apiBase = mode === 'shifts' ? '/api/shift-assignments' : '/api/pikett-assignments';
      const res = await authFetch(`${apiBase}?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCalendarAssignments(data);
      }
    } catch {
    } finally {
      setCalendarLoading(false);
    }
  }, [calendarMonth, calendarYear, selectedTeam, mode, authFetch]);

  React.useEffect(() => {
    if (isReady && selectedView === 'calendar') {
      fetchCalendarAssignments();
    }
  }, [isReady, selectedView, fetchCalendarAssignments]);

  const { holidays, isUserOnHoliday } = useHolidays();
  const { shifts, loading: shiftsLoading } = useShifts();
  const { piketts } = usePiketts();

  const [usersAvailability, setUsersAvailability] = useState<{
    available: any[];
    alreadyAssigned: any[];
    refused: any[];
    unavailable: Array<{ user: any; reason: string }>;
  }>({ available: [], alreadyAssigned: [], refused: [], unavailable: [] });
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Check which users are OOF/busy on a date via getSchedule (delegated perms)
  const fetchUnavailableUsersForDate = async (date: string, userEmails: string[]): Promise<Map<string, { status: string; subject?: string }>> => {
    const unavailableMap = new Map<string, { status: string; subject?: string }>();

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        return unavailableMap;
      }
      if (userEmails.length === 0) return unavailableMap;

      const batchSize = 20;
      for (let i = 0; i < userEmails.length; i += batchSize) {
        const batch = userEmails.slice(i, i + batchSize);

        const scheduleResponse = await fetch('https://graph.microsoft.com/v1.0/me/calendar/getSchedule', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'outlook.timezone="Europe/Zurich"'
          },
          body: JSON.stringify({
            schedules: batch,
            startTime: {
              dateTime: date + 'T00:00:00',
              timeZone: 'Europe/Zurich'
            },
            endTime: {
              dateTime: date + 'T23:59:59',
              timeZone: 'Europe/Zurich'
            },
            availabilityViewInterval: 60
          })
        });

        if (!scheduleResponse.ok) {
          continue;
        }

        const scheduleData = await scheduleResponse.json();

        if (!scheduleData.value) {
          continue;
        }

        for (const userSchedule of scheduleData.value) {
          const userEmail = (userSchedule.scheduleId || '').toLowerCase();

          const items = userSchedule.scheduleItems || [];
          const oofItem = items.find((item: any) => item.status === 'oof');
          const busyItem = items.find((item: any) => item.status === 'busy');

          if (oofItem) {
            unavailableMap.set(userEmail, { status: 'oof', subject: oofItem.subject });
          } else if (busyItem) {
            unavailableMap.set(userEmail, { status: 'busy', subject: busyItem.subject });
          } else if (userSchedule.availabilityView) {
            // Fallback when scheduleItems absent
            const viewCodes = userSchedule.availabilityView.split('');
            if (viewCodes.some((c: string) => c === '3')) {
              unavailableMap.set(userEmail, { status: 'oof' });
            } else if (viewCodes.some((c: string) => c === '2')) {
              unavailableMap.set(userEmail, { status: 'busy' });
            }
          }
        }
      }
    } catch (error) {
    }

    return unavailableMap;
  };

  const isUserWorkingOnDay = (user: any, date: string, shiftTime?: string): boolean => {
    if (!user.availability) return true;

    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];

    const dayAvailability = user.availability[dayName];
    if (!dayAvailability) return true;

    if (shiftTime) {
      const [hour] = shiftTime.split(':').map(Number);
      if (hour < 13) {
        return dayAvailability.morning === true;
      } else {
        return dayAvailability.afternoon === true;
      }
    }

    return dayAvailability.morning === true || dayAvailability.afternoon === true;
  };

  const getEligibleUsersForShift = (shift: any, excludeUserId?: string): any[] => {
    if (!users) return [];

    const activeUsers = users.filter(u => u.status === 'ACTIVE' || u.status === 'active');

    const teamUsers = activeUsers.filter(u =>
      u.teamId === shift.team?.id &&
      !(shift.excludedUserIds || []).includes(u.id) &&
      u.id !== excludeUserId
    );

    const includedUsers = activeUsers.filter(u =>
      (shift.includedUserIds || []).includes(u.id) &&
      u.id !== excludeUserId
    );

    const allEligible = [...teamUsers, ...includedUsers];
    const uniqueEligible = Array.from(new Map(allEligible.map(u => [u.id, u])).values());

    return uniqueEligible;
  };

  React.useEffect(() => {
    if (!resendingAssignment) {
      setUsersAvailability({ available: [], alreadyAssigned: [], refused: [], unavailable: [] });
      return;
    }

    const calculateAvailability = async () => {
      setCheckingAvailability(true);

      try {
        const normalizeDate = (dateVal: string | Date) => {
          const dt = new Date(dateVal);
          return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        };
        const dateStr = normalizeDate(resendingAssignment.date);
        const shift = resendingAssignment.shift;

        const eligibleUsers = getEligibleUsersForShift(shift);

        // Fetch assignments across prev/current/next day for accurate checks
        const assignmentDate = new Date(dateStr);
        const prevDate = new Date(assignmentDate);
        prevDate.setDate(prevDate.getDate() - 1);
        const nextDate = new Date(assignmentDate);
        nextDate.setDate(nextDate.getDate() + 1);
        const prevDateStr = normalizeDate(prevDate);
        const nextDateStr = normalizeDate(nextDate);

        let dateAssignments = assignments;
        try {
          const res = await authFetch(`/api/shift-assignments?startDate=${prevDateStr}&endDate=${nextDateStr}`);
          if (res.ok) {
            dateAssignments = await res.json();
          } else {
          }
        } catch (e) {
        }

        const eligibleEmails = eligibleUsers.filter(u => u.email).map(u => u.email);
        const unavailableUsersMap = await fetchUnavailableUsersForDate(dateStr, eligibleEmails);

        const available: any[] = [];
        const alreadyAssigned: any[] = [];
        const refused: any[] = [];
        const unavailable: Array<{ user: any; reason: string }> = [];

        for (const user of eligibleUsers) {
          const refusedAssignment = dateAssignments.find(a =>
            normalizeDate(a.date) === dateStr &&
            a.userId === user.id &&
            (a as any).shiftId === (resendingAssignment as any).shiftId &&
            a.status === 'REFUSED'
          );

          if (refusedAssignment) {
            refused.push(user);
            continue;
          }

          const activeAssignmentToday = dateAssignments.find(a =>
            normalizeDate(a.date) === dateStr &&
            a.userId === user.id &&
            a.id !== resendingAssignment.id &&
            a.status !== 'REFUSED' &&
            a.status !== 'CANCELLED'
          );

          if (activeAssignmentToday) {
            alreadyAssigned.push({ ...user, _assignedShiftName: (activeAssignmentToday as any).shift?.name || (activeAssignmentToday as any).pikett?.name || 'Shift' });
            continue;
          }

          const canton = user.location || 'BE';
          if (isUserOnHoliday(canton, dateStr)) {
            const holidayForDate = holidays.find(h => {
              const hDateStr = normalizeDate(h.date);
              return hDateStr === dateStr && h.cantons.includes(canton);
            });
            unavailable.push({
              user,
              reason: holidayForDate ? t('reasonHolidayWithName', { name: holidayForDate.name }) : t('reasonHoliday')
            });
            continue;
          }

          if (!isUserWorkingOnDay(user, dateStr, shift?.startTime)) {
            unavailable.push({ user, reason: t('reasonNotWorkingToday') });
            continue;
          }

          const userCalendarStatus = unavailableUsersMap.get(user.email?.toLowerCase());
          if (userCalendarStatus) {
            if (userCalendarStatus.status === 'oof') {
              unavailable.push({ user, reason: t('reasonOutOfOffice') });
              continue;
            }
            if (userCalendarStatus.status === 'busy') {
              const busySubject = userCalendarStatus.subject || '';
              unavailable.push({ user, reason: busySubject ? `${t('reasonBusy')} (${busySubject})` : t('reasonBusy') });
              continue;
            }
          }

          const hasConsecutiveShift = dateAssignments.some(a => {
            const aDateNorm = normalizeDate(a.date);
            return (aDateNorm === prevDateStr || aDateNorm === nextDateStr) &&
              a.userId === user.id &&
              a.status !== 'REFUSED' &&
              a.status !== 'CANCELLED';
          });

          if (hasConsecutiveShift) {
            const consecutiveAssignments = dateAssignments.filter(a => {
              const aDateNorm = normalizeDate(a.date);
              return (aDateNorm === prevDateStr || aDateNorm === nextDateStr) &&
                a.userId === user.id &&
                a.status !== 'REFUSED' &&
                a.status !== 'CANCELLED';
            });
            const shiftNames = consecutiveAssignments.map(a => (a as any).shift?.name || (a as any).pikett?.name || 'Shift').join(', ');
            unavailable.push({ user, reason: t('reasonConsecutiveShift', { shifts: shiftNames }) });
            continue;
          }

          available.push(user);
        }

        setUsersAvailability({ available, alreadyAssigned, refused, unavailable });
      } catch (error) {
      } finally {
        setCheckingAvailability(false);
      }
    };

    calculateAvailability();
  }, [resendingAssignment, assignments, users]);

  const handleResend = async () => {
    if (!resendingAssignment || !selectedNewUser) return;

    setResending(true);

    try {
      const newUser = users?.find(u => u.id === selectedNewUser);
      if (!newUser) throw new Error(t('userNotFound'));

      const shiftOrPikett = mode === 'shifts' ? resendingAssignment.shift : resendingAssignment.pikett;
      const date = new Date(resendingAssignment.date);
      const itemName = shiftOrPikett.name;

      const startTime = mode === 'shifts' ? (shiftOrPikett.startTime || '00:00') : '00:00';
      const endTime = mode === 'shifts' ? (shiftOrPikett.endTime || '23:59') : '23:59';

      const [startHour, startMinute] = startTime.split(':');
      const [endHour, endMinute] = endTime.split(':');

      const startDateTime = new Date(date);
      startDateTime.setHours(parseInt(startHour), parseInt(startMinute), 0);

      const endDateTime = new Date(date);
      endDateTime.setHours(parseInt(endHour), parseInt(endMinute), 0);

      if (endDateTime <= startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1);
      }

      const mailbox = shiftOrPikett.senderMailbox || 'me';

      const event = {
        subject: `${itemName} - ${newUser.firstName} ${newUser.lastName}`,
        body: {
          contentType: 'HTML',
          content: `
            <h2>${itemName}</h2>
            <p><strong>${t('invitationEmailDate')}</strong> ${date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p><strong>${t('invitationEmailSchedule')}</strong> ${startTime} - ${endTime}</p>
            ${shiftOrPikett.description ? `<p><strong>${t('invitationEmailDescription')}</strong> ${shiftOrPikett.description}</p>` : ''}
            <hr>
            <p><em>${t('invitationSentFromDashboard')}</em></p>
          `
        },
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'Europe/Zurich'
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'Europe/Zurich'
        },
        attendees: [
          {
            emailAddress: {
              address: newUser.email,
              name: `${newUser.firstName} ${newUser.lastName}`
            },
            type: 'required'
          }
        ],
        location: {
          displayName: 'Office'
        },
        isReminderOn: true,
        reminderMinutesBeforeStart: 1440,
        responseRequested: true,
        allowNewTimeProposals: false,
        showAs: 'busy',
        categories: [mode === 'shifts' ? 'Shift' : 'Pikett', itemName]
      };

      const graphToken = await getAccessToken();
      if (!graphToken) throw new Error('No Graph access token');

      const outlookResponse = await authFetch('/api/outlook/send-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Graph-Token': graphToken },
        body: JSON.stringify({ mailbox, event })
      });

      if (!outlookResponse.ok) {
        const errorBody = await outlookResponse.json().catch(() => ({}));
        throw new Error(errorBody?.graphError || errorBody?.error || t('outlookSendError'));
      }

      const createdEvent = await outlookResponse.json();

      const apiBase = mode === 'shifts' ? '/api/shift-assignments' : '/api/pikett-assignments';

      const patchResponse = await authFetch(`${apiBase}/${resendingAssignment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resent: true,
          resentAt: new Date().toISOString()
        })
      });

      if (!patchResponse.ok) {
        throw new Error(t('updateError'));
      }

      const assignmentPayload = mode === 'shifts'
        ? { date: resendingAssignment.date, shiftId: shiftOrPikett.id, userId: newUser.id, status: 'PENDING' }
        : { date: resendingAssignment.date, pikettId: shiftOrPikett.id, userId: newUser.id, status: 'PENDING' };

      const createResponse = await authFetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: [assignmentPayload] })
      });

      if (!createResponse.ok) {
        throw new Error(t('createError'));
      }

      const createResult = await createResponse.json();
      const newAssignment = createResult.assignments?.find((a: any) => a.userId === newUser.id);
      if (newAssignment) {
        await authFetch(`${apiBase}/${newAssignment.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outlookEventId: createdEvent.eventId, resentFromId: resendingAssignment.id })
        });
      }

      if (resendingAssignment.outlookEventId) {
        try {
          await authFetch('/api/outlook/send-event', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'X-Graph-Token': graphToken },
            body: JSON.stringify({
              mailbox,
              eventId: resendingAssignment.outlookEventId
            })
          });
        } catch {
        }
      }

      await refresh(); fetchCalendarAssignments();

      setActionMessage({
        type: 'success',
        text: t('resendSuccess', { name: `${newUser.firstName} ${newUser.lastName}` })
      });
      setTimeout(() => setActionMessage(null), 5000);

      setResendingAssignment(null);
      setSelectedNewUser(null);

    } catch (error) {
      setActionMessage({
        type: 'error',
        text: error instanceof Error ? error.message : t('resendError')
      });
      setTimeout(() => setActionMessage(null), 5000);
    } finally {
      setResending(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingAssignment) return;

    setDeleting(true);
    try {
      if (deletingAssignment.outlookEventId) {
        const graphToken = await getAccessToken();
        if (graphToken) {
          const mailbox = (mode === 'shifts' ? deletingAssignment.shift?.senderMailbox : deletingAssignment.pikett?.senderMailbox) || 'me';
          try {
            await authFetch('/api/outlook/send-event', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json', 'X-Graph-Token': graphToken },
              body: JSON.stringify({ mailbox, eventId: deletingAssignment.outlookEventId })
            });
          } catch {
          }
        }
      }

      const apiBase = mode === 'shifts' ? '/api/shift-assignments' : '/api/pikett-assignments';
      const res = await authFetch(`${apiBase}/${deletingAssignment.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(t('deleteError'));

      await refresh(); fetchCalendarAssignments();
      setDeletingAssignment(null);
      setActionMessage({ type: 'success', text: t('deleteSuccess') });
      setTimeout(() => setActionMessage(null), 5000);
    } catch (error) {
      setActionMessage({
        type: 'error',
        text: error instanceof Error ? error.message : t('deleteError')
      });
      setTimeout(() => setActionMessage(null), 5000);
    } finally {
      setDeleting(false);
    }
  };

  const syncOutlook = async () => {
    await triggerSync();
    await refresh();
    fetchCalendarAssignments();
  };

  const userStatsWithDetails = useMemo(() => {
    if (!userStats || !users) return [];

    return userStats.map(stat => {
      const user = users.find(u => u.id === stat.userId);
      const userAssignments = assignments.filter(a => a.userId === stat.userId);

      const itemMap = new Map<string, { name: string; color: string; total: number; accepted: number; pending: number; refused: number; cancelled: number }>();
      userAssignments.forEach(a => {
        const item = mode === 'shifts' ? (a as any).shift : (a as any).pikett;
        const key = item?.id || 'unknown';
        const entry = itemMap.get(key) || { name: item?.name || '?', color: item?.color || '#94a3b8', total: 0, accepted: 0, pending: 0, refused: 0, cancelled: 0 };
        entry.total++;
        if (a.status === 'ACCEPTED') entry.accepted++;
        else if (a.status === 'PENDING') entry.pending++;
        else if (a.status === 'REFUSED') entry.refused++;
        else if (a.status === 'CANCELLED') entry.cancelled++;
        itemMap.set(key, entry);
      });

      const userPiketts = piketts.filter(p => p.userId === stat.userId && p.status === 'ACTIVE');

      return {
        ...stat,
        user,
        assignments: userAssignments,
        shiftBreakdown: Array.from(itemMap.values()).sort((a, b) => b.total - a.total),
        pikettCount: userPiketts.length,
        pikettNames: userPiketts.map(p => p.name)
      };
    }).filter(stat => stat.user);
  }, [userStats, users, assignments, piketts, mode]);

  const filteredAssignments = useMemo(() => {
    let filtered = [...assignments];

    if (selectedUser !== 'all') {
      filtered = filtered.filter(a => a.userId === selectedUser);
    }

    if (selectedShift !== 'all') {
      filtered = filtered.filter(a =>
        mode === 'shifts' ? (a as any).shift?.id === selectedShift : (a as any).pikett?.id === selectedShift
      );
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(a => a.status === selectedStatus);
    }

    if (selectedDate) {
      filtered = filtered.filter(a => {
        const assignmentDate = new Date(a.date).toISOString().split('T')[0];
        return assignmentDate === selectedDate;
      });
    }

    if (sortByDate) {
      filtered.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortByDate === 'asc' ? dateA - dateB : dateB - dateA;
      });
    }

    return filtered;
  }, [assignments, selectedUser, selectedShift, selectedStatus, selectedDate, sortByDate]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredAssignments.length / itemsPerPage);
  }, [filteredAssignments.length, itemsPerPage]);

  const paginatedAssignments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAssignments.slice(startIndex, endIndex);
  }, [filteredAssignments, currentPage, itemsPerPage]);

  const recentAssignments = paginatedAssignments;

  const getStatusBadge = (status: string) => {
    const configs = {
      ACCEPTED: { label: t('statusAccepted'), color: 'bg-green-100 text-green-800' },
      REFUSED: { label: t('statusRefused'), color: 'bg-red-100 text-red-800' },
      PENDING: { label: t('statusNoAnswer'), color: 'bg-blue-100 text-blue-800' },
      TENTATIVE: { label: t('statusTentative'), color: 'bg-orange-100 text-orange-800' },
      CANCELLED: { label: t('statusCancelled'), color: 'bg-gray-100 text-gray-800' }
    };

    const config = configs[status as keyof typeof configs] || configs.PENDING;
    return (
      <Badge className={`${config.color} border-0`}>
        {config.label}
      </Badge>
    );
  };

  const getStatusLabel = (status: string) => {
    const configs = {
      ACCEPTED: t('statusAccepted'),
      REFUSED: t('statusRefused'),
      PENDING: t('statusNoAnswer'),
      TENTATIVE: t('statusTentative'),
      CANCELLED: t('statusCancelled')
    };
    return configs[status as keyof typeof configs] || t('statusNoAnswer');
  };

  const downloadCsv = (content: string, filename: string) => {
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = () => {
    const date = new Date().toISOString().split('T')[0];
    if (selectedView === 'shifts') {
      const itemLabel = mode === 'shifts' ? t('shift') : t('pikett');
      const csv = [
        [t('user'), t('team'), itemLabel, t('schedule'), t('date'), t('status')].join(';'),
        ...assignments.map(a => {
          const item = mode === 'shifts' ? (a as any).shift : (a as any).pikett;
          const schedule = mode === 'shifts' ? `${item?.startTime} - ${item?.endTime}` : (item?.is24_7 ? '24/7' : '');
          return [
            `${a.user.firstName} ${a.user.lastName}`, a.user.team?.name || tCommon('noTeam'),
            item?.name || '', schedule,
            new Date(a.date).toLocaleDateString('fr-FR'), getStatusLabel(a.status)
          ].join(';');
        })
      ].join('\n');
      downloadCsv(csv, `dashboard_${mode}_${date}.csv`);
    } else {
      const csv = [
        [t('user'), t('team'), t('totalShifts'), t('accepted'), t('pending'), t('refused'), t('cancelled'), t('acceptanceRate'), t('shiftBreakdown'), 'Pikett'].join(';'),
        ...userStatsWithDetails.map(s => [
          `${s.user?.firstName} ${s.user?.lastName}`, s.user?.team?.name || tCommon('noTeam'),
          s.total, s.accepted, s.pending, s.refused, s.cancelled,
          `${s.total > 0 ? Math.round((s.accepted / s.total) * 100) : 0}%`,
          s.shiftBreakdown.map((sb: any) => `${sb.name}(${sb.accepted}/${sb.total})`).join(' | '),
          s.pikettNames.join(' | ')
        ].join(';'))
      ].join('\n');
      downloadCsv(csv, `dashboard_utilisateurs_${date}.csv`);
    }
  };

  const StatCard = ({ icon: Icon, title, value, change, color }: any) => (
    <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
            <div className="flex items-baseline space-x-2">
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
              {change !== undefined && change !== 0 && (
                <span className={`text-sm font-medium ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {change > 0 ? '+' : ''}{change}%
                </span>
              )}
            </div>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color.replace('text-', 'bg-').replace('-600', '-100')}`}>
            <Icon className={`w-6 h-6 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />

      <main className="p-6 space-y-6">
        {/* Sync / action message */}
        {(syncMessage || actionMessage) && (() => {
          const msg = actionMessage || syncMessage;
          return (
            <Card className={`border-0 ${msg!.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {msg!.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                  <p className={`text-sm font-medium ${msg!.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                    {msg!.text}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Connection/data error banner */}
        {error && !loading && (
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <p className="text-sm font-medium text-amber-800">
                  {tCommon('dataLoadError')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">{t('title')}</h1>
          </div>

          <div className="flex items-center space-x-3">
            <Tabs value={dateFilter} onValueChange={(v) => setDateFilter(v as any)} className="w-auto">
              <TabsList className="grid grid-cols-5 w-auto">
                <TabsTrigger value="7d" className="text-xs">{t('days7')}</TabsTrigger>
                <TabsTrigger value="30d" className="text-xs">{t('days30')}</TabsTrigger>
                <TabsTrigger value="90d" className="text-xs">{t('days90')}</TabsTrigger>
                <TabsTrigger value="180d" className="text-xs">{t('days180')}</TabsTrigger>
                <TabsTrigger value="all" className="text-xs">{t('allPeriod')}</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={syncOutlook}
                disabled={syncing || loading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {syncing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {syncing ? t('syncing') : t('sync')}
              </Button>
              <span className="text-xs text-slate-400">
                {Math.floor(nextSyncIn / 60)}:{String(nextSyncIn % 60).padStart(2, '0')}
              </span>
            </div>

            <Button variant="outline" size="sm" onClick={handleExport} className="hover:bg-secondary/20">
              <Download className="w-4 h-4 mr-2" />
              {tCommon('export')}
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            icon={CheckCircle}
            title={mode === 'shifts' ? t('shiftsAccepted') : t('pikettsAccepted')}
            value={stats.accepted}
            color="text-green-600"
          />
          <StatCard
            icon={XCircle}
            title={mode === 'shifts' ? t('shiftsRefused') : t('pikettsRefused')}
            value={stats.refused}
            color="text-red-600"
          />
          <StatCard
            icon={Clock3}
            title={t('pending')}
            value={stats.pending}
            color="text-orange-600"
          />
          <StatCard
            icon={Send}
            title={mode === 'shifts' ? t('shiftsResent') : t('pikettsResent')}
            value={(stats as any).resent ?? 0}
            color="text-purple-600"
          />
          <StatCard
            icon={AlertCircle}
            title={mode === 'shifts' ? t('shiftsRefusedNotResent') : t('pikettsRefusedNotResent')}
            value={(stats as any).refusedNotResent ?? 0}
            color="text-amber-600"
          />
          <StatCard
            icon={TrendingUp}
            title={mode === 'shifts' ? t('totalShifts') : t('totalPiketts')}
            value={stats.total}
            color="text-blue-600"
          />
        </div>

        {/* Mode toggle + Filter by team */}
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center border rounded-lg">
                <Button
                  variant={mode === 'shifts' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setMode('shifts')}
                  className={mode === 'shifts' ? 'rounded-r-none' : 'rounded-r-none hover:bg-secondary/20'}
                >
                  {t('modeShifts')}
                </Button>
                <Button
                  variant={mode === 'pikett' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setMode('pikett')}
                  className={mode === 'pikett' ? 'rounded-l-none' : 'rounded-l-none hover:bg-secondary/20'}
                >
                  {t('modePikett')}
                </Button>
              </div>
              <div className="w-px h-6 bg-slate-200" />
              <Filter className="w-5 h-5 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">{t('filterByTeam')}</span>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger className="w-auto">
                  <Network className="w-4 h-4 mr-2 text-slate-500" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-400 to-purple-400"></div>
                      <span>{t('allTeams')}</span>
                    </div>
                  </SelectItem>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: team.color }}
                        />
                        {team.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for different views */}
        <Tabs value={selectedView} onValueChange={(v) => setSelectedView(v as any)} className="space-y-4">
          <TabsList>
            <TabsTrigger value="shifts" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {mode === 'shifts' ? t('recentShifts') : t('recentPiketts')}
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              {t('byUser')}
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {t('calendarView')}
            </TabsTrigger>
          </TabsList>

          {/* Recent Shifts View */}
          <TabsContent value="shifts">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <div>
                  <CardTitle className="text-xl font-semibold text-slate-800">
                    {mode === 'shifts' ? t('recentShifts') : t('recentPiketts')}
                  </CardTitle>
                  <p className="text-sm text-slate-600 mt-1">
                    {mode === 'shifts' ? t('recentShiftsSubtitle') : t('recentPikettsSubtitle')}
                  </p>
                </div>

                {/* Filters */}
                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-5 gap-4">
                    {/* Filter by user */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-slate-600">{t('userFilter')}</label>
                      <Select value={selectedUser} onValueChange={setSelectedUser}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('allFilter')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('allFilter')}</SelectItem>
                          {users?.map(user => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.firstName} {user.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Filter by shift/pikett */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-slate-600">
                        {mode === 'shifts' ? t('shiftFilter') : t('pikettFilter')}
                      </label>
                      <Select value={selectedShift} onValueChange={setSelectedShift}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('allFilter')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('allFilter')}</SelectItem>
                          {mode === 'shifts'
                            ? shifts?.map(shift => (
                                <SelectItem key={shift.id} value={shift.id}>
                                  {shift.name}
                                </SelectItem>
                              ))
                            : piketts?.map(pikett => (
                                <SelectItem key={pikett.id} value={pikett.id}>
                                  {pikett.name}
                                </SelectItem>
                              ))
                          }
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Filter by date */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-slate-600">{tCommon('date')}</label>
                      <Input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full"
                      />
                    </div>

                    {/* Filter by status */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-slate-600">{t('statusFilter')}</label>
                      <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('allFilter')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('allFilter')}</SelectItem>
                          <SelectItem value="ACCEPTED">{t('statusAccepted')}</SelectItem>
                          <SelectItem value="REFUSED">{t('statusRefused')}</SelectItem>
                          <SelectItem value="PENDING">{t('statusNoAnswer')}</SelectItem>
                          <SelectItem value="TENTATIVE">{t('statusTentative')}</SelectItem>
                          <SelectItem value="CANCELLED">{t('statusCancelled')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Reset button - aligned with Actions */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-slate-600 invisible">Actions</label>
                      <Button
                        variant="outline"
                        size="default"
                        onClick={resetFilters}
                        className="hover:bg-secondary/20 w-full"
                      >
                        <FilterX className="w-4 h-4 mr-2" />
                        {tCommon('resetFilters')}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-600" />
                    <p className="text-slate-500">{t('loadingShifts')}</p>
                  </div>
                ) : assignments.length === 0 ? (
                  <div className="text-center py-12">
                    <Send className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <h3 className="text-lg font-medium text-slate-800 mb-2">
                      {mode === 'shifts' ? t('noShiftsSent') : t('noPikettsSent')}
                    </h3>
                    <p className="text-slate-600 mb-6">
                      {mode === 'shifts' ? t('noShiftsSentDesc') : t('noPikettsSentDesc')}
                    </p>
                    <Button className="bg-primary hover:bg-primary/90" onClick={() => window.location.href = '/planner'}>
                      <Calendar className="w-4 h-4 mr-2" />
                      {t('goToPlanner')}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left text-slate-600 font-medium py-3 px-2">{t('user')}</th>
                            <th className="text-left text-slate-600 font-medium py-3 px-2">{mode === 'shifts' ? t('shift') : t('pikett')}</th>
                            <th
                              className="text-left text-slate-600 font-medium py-3 px-2 cursor-pointer select-none group"
                              onClick={() => setSortByDate(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc')}
                            >
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 -mx-2 -my-1 rounded-md hover:bg-slate-100 transition-colors">
                                {t('date')}
                                {sortByDate === 'asc' && <ArrowUp className="w-3.5 h-3.5 text-blue-600" />}
                                {sortByDate === 'desc' && <ArrowDown className="w-3.5 h-3.5 text-blue-600" />}
                                {!sortByDate && <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />}
                              </span>
                            </th>
                            <th className="text-left text-slate-600 font-medium py-3 px-2">{t('status')}</th>
                            <th className="text-left text-slate-600 font-medium py-3 px-2">{t('actions')}</th>
                            <th className="text-left text-slate-600 font-medium py-3 px-2">{t('sentBy')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentAssignments.map((assignment) => {
                            return (
                            <tr key={assignment.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${(assignment as any).resentFromId ? 'border-l-3 border-l-amber-400 bg-amber-50/30' : ''}`}>
                              <td className="py-4 px-2">
                                <div className="flex items-center space-x-3">
                                  <div className="relative">
                                    <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center">
                                      <span className="text-white text-sm font-medium">
                                        {assignment.user.firstName[0]}{assignment.user.lastName[0]}
                                      </span>
                                    </div>
                                    {(assignment as any).resentFromId && (
                                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                                        <RefreshCw className="w-3 h-3 text-white" />
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium text-slate-800">
                                      {assignment.user.firstName} {assignment.user.lastName}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {assignment.user.team?.name || tCommon('noTeam')}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 px-2">
                                <div>
                                  <p className="font-medium text-slate-800">
                                    {mode === 'shifts' ? (assignment as any).shift?.name : (assignment as any).pikett?.name}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {mode === 'shifts'
                                      ? `${(assignment as any).shift?.startTime} - ${(assignment as any).shift?.endTime}`
                                      : (assignment as any).pikett?.is24_7 ? '24/7' : ''
                                    }
                                  </p>
                                </div>
                              </td>
                              <td className="py-4 px-2 text-slate-600">
                                {new Date(assignment.date).toLocaleDateString('fr-FR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                                })}
                              </td>
                              <td className="py-4 px-2">
                                {getStatusBadge(assignment.status)}
                              </td>
                              <td className="py-4 px-2">
                                <div className="flex items-center gap-2">
                                  {assignment.resent ? (
                                    <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs px-3 py-1.5">
                                      ✓ {t('resent')}
                                    </Badge>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setResendingAssignment(assignment)}
                                      className="hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300"
                                    >
                                      <Send className="w-4 h-4 mr-2" />
                                      {t('resend')}
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setDeletingAssignment(assignment)}
                                    className="hover:bg-red-100 hover:text-red-600 hover:border-red-300"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                              <td className="py-4 px-2">
                                {(assignment as any).sentBy ? (
                                  <div className="text-xs">
                                    <p className="font-medium text-slate-700">
                                      {(assignment as any).sentBy.firstName} {(assignment as any).sentBy.lastName}
                                    </p>
                                    <p className="text-slate-500">
                                      {new Date(assignment.createdAt).toLocaleString(locale, {
                                        day: '2-digit', month: '2-digit', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                      })}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200 flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <p className="text-sm text-slate-600">
                          {t('pageOf', { current: currentPage, total: totalPages })} • {t('results', { count: filteredAssignments.length })}
                        </p>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-slate-500">{t('perPage')}</label>
                          <Select
                            value={String(itemsPerPage)}
                            onValueChange={(v) => { setItemsPerPage(parseInt(v, 10)); setCurrentPage(1); }}
                          >
                            <SelectTrigger className="h-8 w-20 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="25">25</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                              <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {totalPages > 1 && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="hover:bg-secondary/20"
                          >
                            {t('previous')}
                          </Button>

                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              let pageNum;
                              if (totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (currentPage <= 3) {
                                pageNum = i + 1;
                              } else if (currentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                              } else {
                                pageNum = currentPage - 2 + i;
                              }

                              return (
                                <Button
                                  key={pageNum}
                                  variant={currentPage === pageNum ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setCurrentPage(pageNum)}
                                  className={currentPage === pageNum ? "bg-blue-600 hover:bg-blue-700" : "hover:bg-secondary/20"}
                                >
                                  {pageNum}
                                </Button>
                              );
                            })}
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className="hover:bg-secondary/20"
                          >
                            {t('next')}
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Per User View */}
          <TabsContent value="users">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-slate-800">
                  {t('shiftsByUser')}
                </CardTitle>
                <p className="text-sm text-slate-600 mt-1">
                  {t('shiftsByUserSubtitle')}
                </p>
              </CardHeader>
              <CardContent>
                {loading || usersLoading ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-600" />
                    <p className="text-slate-500">{t('loadingStats')}</p>
                  </div>
                ) : userStatsWithDetails.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <h3 className="text-lg font-medium text-slate-800 mb-2">
                      {t('noDataAvailable')}
                    </h3>
                    <p className="text-slate-600">
                      {t('noDataAvailableDesc')}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {userStatsWithDetails.map((userStat) => (
                      <div key={userStat.userId} className="border border-slate-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center">
                              <span className="text-white font-medium">
                                {userStat.user?.firstName[0]}{userStat.user?.lastName[0]}
                              </span>
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-800">
                                {userStat.user?.firstName} {userStat.user?.lastName}
                              </h4>
                              <p className="text-sm text-slate-600">
                                {userStat.user?.team?.name || tCommon('noTeam')}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-slate-800">{userStat.total}</p>
                            <p className="text-xs text-slate-500">{t('shiftsTotal')}</p>
                          </div>
                        </div>

                        {/* Status breakdown */}
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div className="p-1.5 bg-green-50 rounded">
                            <p className="text-lg font-semibold text-green-700">{userStat.accepted}</p>
                            <p className="text-xs text-green-600">{t('accepted')}</p>
                          </div>
                          <div className="p-1.5 bg-orange-50 rounded">
                            <p className="text-lg font-semibold text-orange-700">{userStat.pending}</p>
                            <p className="text-xs text-orange-600">{t('pending')}</p>
                          </div>
                          <div className="p-1.5 bg-red-50 rounded">
                            <p className="text-lg font-semibold text-red-700">{userStat.refused}</p>
                            <p className="text-xs text-red-600">{t('refused')}</p>
                          </div>
                          <div className="p-1.5 bg-gray-50 rounded">
                            <p className="text-lg font-semibold text-gray-700">{userStat.cancelled}</p>
                            <p className="text-xs text-gray-600">{t('cancelled')}</p>
                          </div>
                        </div>

                        {/* Shift details — donut rings */}
                        {userStat.shiftBreakdown.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-100">
                            <p className="text-xs font-medium text-slate-500 mb-2">{t('shiftDetails')}</p>
                            <div className="flex flex-wrap gap-3">
                              {userStat.shiftBreakdown.map((sb: any, idx: number) => {
                                const r = 16, stroke = 4, size = 44;
                                const circ = 2 * Math.PI * r;
                                const accPct = sb.total > 0 ? sb.accepted / sb.total : 0;
                                const penPct = sb.total > 0 ? sb.pending / sb.total : 0;
                                const refPct = sb.total > 0 ? sb.refused / sb.total : 0;
                                const accOff = circ * (1 - accPct);
                                const penOff = circ * (1 - penPct);
                                const refOff = circ * (1 - refPct);
                                const accRot = -90;
                                const penRot = -90 + accPct * 360;
                                const refRot = -90 + (accPct + penPct) * 360;
                                return (
                                  <div key={idx} className="flex flex-col items-center gap-1 min-w-[52px]">
                                    <div className="relative" style={{ width: size, height: size }}>
                                      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                                        {/* Background ring */}
                                        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
                                        {/* Refused arc (red) — draw first (bottom layer) */}
                                        {sb.refused > 0 && (
                                          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#ef4444" strokeWidth={stroke}
                                            strokeDasharray={circ} strokeDashoffset={refOff} strokeLinecap="round"
                                            style={{ transform: `rotate(${refRot}deg)`, transformOrigin: 'center' }} />
                                        )}
                                        {/* Pending arc (orange) */}
                                        {sb.pending > 0 && (
                                          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f59e0b" strokeWidth={stroke}
                                            strokeDasharray={circ} strokeDashoffset={penOff} strokeLinecap="round"
                                            style={{ transform: `rotate(${penRot}deg)`, transformOrigin: 'center' }} />
                                        )}
                                        {/* Accepted arc (green) — draw last (top layer) */}
                                        {sb.accepted > 0 && (
                                          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#22c55e" strokeWidth={stroke}
                                            strokeDasharray={circ} strokeDashoffset={accOff} strokeLinecap="round"
                                            style={{ transform: `rotate(${accRot}deg)`, transformOrigin: 'center' }} />
                                        )}
                                      </svg>
                                      {/* Center text */}
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-[10px] font-semibold text-slate-700">{sb.accepted}/{sb.total}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sb.color }} />
                                      <span className="text-[10px] text-slate-600 truncate max-w-[60px]">{sb.name}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Pikett info */}
                        {userStat.pikettCount > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-1.5">
                              <Badge className="bg-red-100 text-red-700 border-0 text-xs">
                                {t('pikettActive', { count: userStat.pikettCount })}
                              </Badge>
                              <span className="text-xs text-slate-500 truncate">
                                {userStat.pikettNames.join(', ')}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Calendar View */}
          <TabsContent value="calendar">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-3">
                  {/* < Month Year > */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-green-100 hover:text-green-700"
                      onClick={() => {
                        if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1); }
                        else setCalendarMonth(m => m - 1);
                      }}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-medium text-slate-700 capitalize min-w-[140px] text-center select-none">
                      {new Date(calendarYear, calendarMonth).toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-green-100 hover:text-green-700"
                      onClick={() => {
                        if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1); }
                        else setCalendarMonth(m => m + 1);
                      }}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                    onClick={() => {
                      const today = new Date();
                      setCalendarMonth(today.getMonth());
                      setCalendarYear(today.getFullYear());
                    }}
                  >
                    {t('today')}
                  </Button>

                  {/* Legend on the same line, pushed to the right when there's space */}
                  <div className="flex items-center gap-3 text-xs text-slate-600 ml-auto flex-wrap">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> {t('statusAccepted')}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> {t('statusRefused')}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> {t('statusNoAnswer')}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> {t('statusTentative')}</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400 inline-block" /> {t('statusCancelled')}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {calendarLoading ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-600" />
                    <p className="text-slate-500">{t('loadingShifts')}</p>
                  </div>
                ) : (
                  <>
                    {/* Day headers */}
                    <div className="grid grid-cols-7 mb-1">
                      {[t('mon'), t('tue'), t('wed'), t('thu'), t('fri'), t('sat'), t('sun')].map(day => (
                        <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">{day}</div>
                      ))}
                    </div>
                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 border-t border-l">
                      {generateCalendarDays().map((day, idx) => {
                        if (!day) {
                          return <div key={`empty-${idx}`} className="border-b border-r bg-slate-50/50 min-h-[100px]" />;
                        }
                        const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                        const rawDayAssignments = calendarByDate[dateStr] || [];
                        // Hide non-ACCEPTED entries once the same shift/pikett has an ACCEPTED one that day
                        const acceptedItemIds = new Set(
                          rawDayAssignments
                            .filter((a: any) => a.status === 'ACCEPTED')
                            .map((a: any) => mode === 'shifts' ? a.shiftId : a.pikettId)
                        );
                        const dayAssignments = rawDayAssignments.filter((a: any) => {
                          const itemId = mode === 'shifts' ? a.shiftId : a.pikettId;
                          if (acceptedItemIds.has(itemId)) {
                            return a.status === 'ACCEPTED';
                          }
                          return true;
                        });
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                        const isToday = dateStr === new Date().toISOString().split('T')[0];
                        const maxVisible = 3;

                        return (
                          <div
                            key={dateStr}
                            className={`border-b border-r min-h-[100px] p-1 cursor-pointer hover:bg-blue-50/50 transition-colors ${isWeekend ? 'bg-slate-50' : ''}`}
                            onClick={() => dayAssignments.length > 0 && setSelectedCalendarDay(dateStr)}
                          >
                            <div className={`text-xs font-medium mb-1 ${isToday ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : 'text-slate-600 px-1'}`}>
                              {day.getDate()}
                            </div>
                            <div className="space-y-0.5">
                              {dayAssignments.slice(0, maxVisible).map((a: any) => (
                                <div key={a.id} className="flex items-center gap-1 text-xs leading-tight truncate">
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDotColor(a.status)}`} />
                                  <span className="truncate text-slate-700">
                                    {(mode === 'shifts' ? a.shift?.name : a.pikett?.name) || ''} — {a.user?.firstName} {a.user?.lastName}
                                  </span>
                                </div>
                              ))}
                              {dayAssignments.length > maxVisible && (
                                <div className="text-xs text-blue-600 font-medium px-1">
                                  {t('moreAssignments', { count: dayAssignments.length - maxVisible })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Day detail dialog */}
      <Dialog open={!!selectedCalendarDay} onOpenChange={(open) => { if (!open) setSelectedCalendarDay(null); }}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>
              {t('dayDetail', { date: selectedCalendarDay ? new Date(selectedCalendarDay + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '' })}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[500px] pr-4">
            {(() => {
              const raw = selectedCalendarDay ? (calendarByDate[selectedCalendarDay] || []) : [];
              const acceptedIds = new Set(
                raw.filter((a: any) => a.status === 'ACCEPTED')
                  .map((a: any) => mode === 'shifts' ? a.shiftId : a.pikettId)
              );
              const filtered = raw.filter((a: any) => {
                if (a.status === 'REFUSED' || a.status === 'CANCELLED') {
                  const itemId = mode === 'shifts' ? a.shiftId : a.pikettId;
                  return !acceptedIds.has(itemId);
                }
                return true;
              });
              return filtered.length === 0 ? (
                <div className="text-center py-8 text-slate-500">{t('noAssignmentsDay')}</div>
              ) : (
              <div className="space-y-2">
                {filtered.map((a: any) => (
                  <div key={a.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg">
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarFallback className="text-xs bg-gradient-to-br from-slate-600 to-slate-700 text-white">
                        {a.user?.firstName?.[0]}{a.user?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-slate-800 truncate">
                        {a.user?.firstName} {a.user?.lastName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {mode === 'shifts' ? `${a.shift?.name} • ${a.shift?.startTime} - ${a.shift?.endTime}` : `${a.pikett?.name}${a.pikett?.is24_7 ? ' • 24/7' : ''}`}
                      </p>
                    </div>
                    {getStatusBadge(a.status)}
                  </div>
                ))}
              </div>
              );
            })()}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Resend modal */}
      <Dialog open={!!resendingAssignment} onOpenChange={(open) => {
        if (!open) {
          setResendingAssignment(null);
          setSelectedNewUser(null);
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('resendTitle')}</DialogTitle>
            <DialogDescription>
              {t('resendDescription', {
                shift: (mode === 'shifts' ? resendingAssignment?.shift?.name : resendingAssignment?.pikett?.name) || '',
                date: resendingAssignment ? new Date(resendingAssignment.date).toLocaleDateString('fr-FR') : ''
              })}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="mt-4 max-h-[500px] pr-4">
            {checkingAvailability ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-600" />
                <p className="text-slate-500">{t('checkingAvailability')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* No eligible users */}
                {usersAvailability.available.length === 0 &&
                 usersAvailability.alreadyAssigned.length === 0 &&
                 usersAvailability.refused.length === 0 &&
                 usersAvailability.unavailable.length === 0 && (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 text-orange-400" />
                    <p className="text-slate-600">{t('noEligibleUsers')}</p>
                  </div>
                )}

                {/* Available users */}
                {usersAvailability.available.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      {t('availableCount', { count: usersAvailability.available.length })}
                    </h4>
                    <div className="space-y-2">
                      {usersAvailability.available.map(user => (
                        <div
                          key={user.id}
                          onClick={() => setSelectedNewUser(user.id)}
                          className={`p-3 border rounded-lg cursor-pointer transition-all ${
                            selectedNewUser === user.id
                              ? 'border-blue-500 bg-blue-50 shadow-sm'
                              : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className="text-xs bg-gradient-to-br from-green-600 to-green-700 text-white">
                                  {user.firstName[0]}{user.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-slate-800">
                                  {user.firstName} {user.lastName}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {user.team?.name || tCommon('noTeam')} • {user.email}
                                </p>
                              </div>
                            </div>
                            {selectedNewUser === user.id && (
                              <CheckCircle className="w-5 h-5 text-blue-600" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Users already assigned today */}
                {usersAvailability.alreadyAssigned.length > 0 && (
                  <div>
                    <div className="border-t pt-3">
                      <h4 className="text-sm font-semibold text-orange-700 mb-2 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        ⚠️ {t('alreadyAssignedTodayWithCount', { count: usersAvailability.alreadyAssigned.length })}
                      </h4>
                      <div className="space-y-2">
                        {usersAvailability.alreadyAssigned.map(user => {
                          return (
                            <div
                              key={user.id}
                              onClick={() => setSelectedNewUser(user.id)}
                              className={`p-3 border rounded-lg cursor-pointer transition-all ${
                                selectedNewUser === user.id
                                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                                  : 'border-orange-200 bg-orange-50 hover:border-blue-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                  <Avatar className="w-8 h-8">
                                    <AvatarFallback className="text-xs bg-orange-600 text-white">
                                      {user.firstName[0]}{user.lastName[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1">
                                    <p className="font-medium text-slate-800">
                                      {user.firstName} {user.lastName}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {user.team?.name || tCommon('noTeam')}
                                    </p>
                                  </div>
                                  <Badge variant="outline" className="text-xs bg-white">
                                    {user._assignedShiftName || t('otherShift')}
                                  </Badge>
                                </div>
                                {selectedNewUser === user.id && (
                                  <CheckCircle className="w-5 h-5 text-blue-600 ml-2" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Users who refused this shift (still selectable in case they change their mind) */}
                {usersAvailability.refused.length > 0 && (
                  <div>
                    <div className="border-t pt-3">
                      <h4 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-slate-500" />
                        {t('refusedThisShift', { count: usersAvailability.refused.length })}
                      </h4>
                      <div className="space-y-2">
                        {usersAvailability.refused.map(user => (
                          <div
                            key={user.id}
                            onClick={() => setSelectedNewUser(user.id)}
                            className={`p-3 border rounded-lg cursor-pointer transition-all ${
                              selectedNewUser === user.id
                                ? 'border-blue-500 bg-blue-50 shadow-sm'
                                : 'border-slate-200 bg-slate-50 hover:border-blue-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <Avatar className="w-8 h-8">
                                  <AvatarFallback className="text-xs bg-slate-500 text-white">
                                    {user.firstName[0]}{user.lastName[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <p className="font-medium text-slate-700">
                                    {user.firstName} {user.lastName}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    {user.team?.name || tCommon('noTeam')}
                                  </p>
                                </div>
                                <Badge variant="outline" className="text-xs bg-white text-slate-500">
                                  {t('refused')}
                                </Badge>
                              </div>
                              {selectedNewUser === user.id && (
                                <CheckCircle className="w-5 h-5 text-blue-600 ml-2" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Users with constraints */}
                {usersAvailability.unavailable.length > 0 && (
                  <div>
                    <div className="border-t pt-3">
                      <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                        <XCircle className="w-4 h-4" />
                        {t('brokenConstraints', { count: usersAvailability.unavailable.length })}
                      </h4>
                      <div className="space-y-2">
                        {usersAvailability.unavailable.map(({ user, reason }) => (
                          <div
                            key={user.id}
                            onClick={() => setSelectedNewUser(user.id)}
                            className={`p-3 border rounded-lg cursor-pointer transition-all ${
                              selectedNewUser === user.id
                                ? 'border-blue-500 bg-blue-50 shadow-sm'
                                : 'border-red-200 bg-red-50 hover:border-blue-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <Avatar className="w-8 h-8">
                                  <AvatarFallback className="text-xs bg-red-600 text-white">
                                    {user.firstName[0]}{user.lastName[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <p className="font-medium text-slate-800">
                                    {user.firstName} {user.lastName}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {user.team?.name || tCommon('noTeam')}
                                  </p>
                                </div>
                                <Badge variant="outline" className="text-xs bg-white">
                                  {reason}
                                </Badge>
                              </div>
                              {selectedNewUser === user.id && (
                                <CheckCircle className="w-5 h-5 text-blue-600 ml-2" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setResendingAssignment(null);
                setSelectedNewUser(null);
              }}
              disabled={resending}
              className="hover:bg-secondary/20"
            >
              <X className="w-4 h-4 mr-2" />
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleResend}
              disabled={!selectedNewUser || resending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {resending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('sending')}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {tCommon('confirm')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation modal */}
      <Dialog open={!!deletingAssignment} onOpenChange={(open) => {
        if (!open && !deleting) {
          setDeletingAssignment(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              {t('deleteTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-700">
              {t('deleteDescription')}
            </p>
            {deletingAssignment && (
              <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="font-medium text-red-800">
                  {(mode === 'shifts' ? deletingAssignment.shift?.name : deletingAssignment.pikett?.name) || ''} — {deletingAssignment.user?.firstName} {deletingAssignment.user?.lastName}
                </p>
                <p className="text-sm text-red-600 mt-1">
                  {new Date(deletingAssignment.date).toLocaleDateString('fr-FR')}
                  {deletingAssignment.outlookEventId && ` • ${t('deleteWarningOutlookOnly')}`}
                </p>
                <p className="text-sm text-red-600 mt-1">
                  {t('deleteWarningDb')}
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setDeletingAssignment(null)}
              disabled={deleting}
              className="hover:bg-secondary/20"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              {tCommon('delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default function DashboardPageProtected() {
  return <ProtectedRoute><DashboardPage /></ProtectedRoute>;
}
