'use client';
//app/dashboard/page.tsx

export const dynamic = 'force-dynamic';

import React, { useState, useMemo } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navigation from '@/components/Navigation';
import { useTranslations } from 'next-intl';
import {
  CheckCircle,
  XCircle,
  Clock3,
  TrendingUp,
  Users,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Eye,
  MoreHorizontal,
  Activity,
  Loader2,
  Send,
  AlertCircle,
  Building2,
  X,
  FilterX
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import { useUsers } from '@/lib/hooks/useUsers';
import { useTeams } from '@/lib/hooks/useTeams';
import { useHolidays } from '@/lib/hooks/useHolidays';
import { useShifts } from '@/lib/hooks/useShifts';
import { useAuthFetch } from '@/lib/hooks/useAuthFetch';
import { useAuth } from '@/contexts/AuthContext';

const DashboardPage = () => {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const authFetch = useAuthFetch();
  const { getAccessToken } = useAuth();
  const [dateFilter, setDateFilter] = useState<'7d' | '30d' | '90d' | '180d' | 'all'>('7d');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedView, setSelectedView] = useState<'shifts' | 'users'>('shifts');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [resendingAssignment, setResendingAssignment] = useState<any | null>(null);
  const [selectedNewUser, setSelectedNewUser] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  // Additional filters
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedShift, setSelectedShift] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [sortByDate, setSortByDate] = useState<'asc' | 'desc' | null>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Function to reset all filters
  const resetFilters = () => {
    setSelectedUser('all');
    setSelectedShift('all');
    setSelectedStatus('all');
    setSelectedDate('');
    setCurrentPage(1); // Reset to first page
  };

  // Reset page to 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedUser, selectedShift, selectedStatus, selectedDate, dateFilter, selectedTeam]);

  // Fetch data with hook
  const {
    assignments,
    stats,
    userStats,
    teamStats,
    loading,
    error,
    refresh
  } = useShiftAssignments({
    dateFilter: dateFilter === 'all' ? undefined : dateFilter,
    teamId: selectedTeam === 'all' ? undefined : selectedTeam
  });

  const { users, loading: usersLoading } = useUsers();
  const { teams, loading: teamsLoading } = useTeams();
  const { holidays, isUserOnHoliday } = useHolidays();
  const { shifts, loading: shiftsLoading } = useShifts();

  const [usersAvailability, setUsersAvailability] = useState<{
    available: any[];
    alreadyAssigned: any[];
    unavailable: Array<{ user: any; reason: string }>;
  }>({ available: [], alreadyAssigned: [], unavailable: [] });
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [outOfOfficeEvents, setOutOfOfficeEvents] = useState<any[]>([]);

  // Function to fetch Out of Office events for a specific date using getSchedule API
  const fetchOutOfOfficeForDate = async (date: string, userEmails?: string[]): Promise<any[]> => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return [];

      // Collect emails to check
      const emails = userEmails || users?.filter((u: any) => u.email && (u.status === 'ACTIVE' || u.status === 'active')).map((u: any) => u.email) || [];
      if (emails.length === 0) return [];

      const allOutOfOfficeEvents: any[] = [];

      // Use getSchedule API (same as planner) - batches of 20
      const batchSize = 20;
      for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);

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
            availabilityViewInterval: 1440
          })
        });

        if (!scheduleResponse.ok) continue;

        const scheduleData = await scheduleResponse.json();

        for (const userSchedule of scheduleData.value) {
          const userEmail = userSchedule.scheduleId?.toLowerCase() || '';
          let hasScheduleItem = false;

          // Check scheduleItems first (detailed events)
          if (userSchedule.scheduleItems && userSchedule.scheduleItems.length > 0) {
            for (const item of userSchedule.scheduleItems) {
              if (item.status === 'oof' || item.status === 'busy') {
                hasScheduleItem = true;
                const endDt = new Date(item.end.dateTime);
                endDt.setDate(endDt.getDate() - 1);
                const adjustedEnd = `${endDt.getFullYear()}-${String(endDt.getMonth() + 1).padStart(2, '0')}-${String(endDt.getDate()).padStart(2, '0')}T23:59:59`;

                allOutOfOfficeEvents.push({
                  id: `schedule-${userEmail}-${item.start.dateTime}`,
                  subject: item.subject || (item.status === 'oof' ? 'Out of Office' : 'Busy'),
                  start: { dateTime: item.start.dateTime },
                  end: { dateTime: adjustedEnd },
                  showAs: item.status,
                  isAllDay: false,
                  organizer: { emailAddress: { address: userEmail, name: '' } },
                  attendees: [{ emailAddress: { address: userEmail, name: '' } }]
                });
              }
            }
          }

          // Fallback: check availabilityView if no scheduleItems were found
          // availabilityView codes: 0=free, 1=tentative, 2=busy, 3=oof, 4=workingElsewhere
          if (!hasScheduleItem && userSchedule.availabilityView) {
            const viewCodes = userSchedule.availabilityView.split('');
            const hasOof = viewCodes.some((c: string) => c === '3');
            const hasBusy = viewCodes.some((c: string) => c === '2');

            if (hasOof || hasBusy) {
              allOutOfOfficeEvents.push({
                id: `availability-${userEmail}-${date}`,
                subject: hasOof ? 'Out of Office' : 'Busy',
                start: { dateTime: date + 'T00:00:00' },
                end: { dateTime: date + 'T23:59:59' },
                showAs: hasOof ? 'oof' : 'busy',
                isAllDay: true,
                organizer: { emailAddress: { address: userEmail, name: '' } },
                attendees: [{ emailAddress: { address: userEmail, name: '' } }]
              });
            }
          }
        }
      }

      return allOutOfOfficeEvents;
    } catch (error) {
      return [];
    }
  };

  // Function to check if a user is available (not OOF)
  const isUserAvailable = (user: any, date: string, oofEvents: any[], shift?: any) => {
    const userEmail = user.email.toLowerCase();

    let dateStart: Date;
    let dateEnd: Date;

    if (shift?.startTime && shift?.endTime) {
      const normalizeTime = (time: string) => {
        const parts = time.split(':');
        return `${parts[0]}:${parts[1]}`;
      };

      const startTime = normalizeTime(shift.startTime);
      const endTime = normalizeTime(shift.endTime);

      dateStart = new Date(date + `T${startTime}:00`);
      dateEnd = new Date(date + `T${endTime}:00`);
    } else {
      dateStart = new Date(date + 'T00:00:00');
      dateEnd = new Date(date + 'T23:59:59');
    }

    const conflicts = oofEvents.filter(event => {
      const eventStart = new Date(event.start.dateTime);
      const eventEnd = new Date(event.end.dateTime);
      const organizerEmail = event.organizer?.emailAddress?.address?.toLowerCase() || '';

      const isUserInvolved = organizerEmail === userEmail ||
        event.attendees?.some((attendee: any) =>
          attendee.emailAddress?.address?.toLowerCase() === userEmail);

      if (!isUserInvolved) return false;

      let adjustedEventEnd = eventEnd;
      if (event.isAllDay) {
        adjustedEventEnd = new Date(eventEnd.getTime() - 1000);
      }

      const hasOverlap = eventStart < dateEnd && adjustedEventEnd > dateStart;

      return hasOverlap;
    });

    return {
      available: conflicts.length === 0,
      conflictEvents: conflicts
    };
  };

  // Function to check if a user works on a given day
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

  // Function to check all constraints for a user
  const checkUserAvailability = async (
    user: any,
    shift: any,
    date: string,
    currentAssignmentId?: string,
    oofEventsOverride?: any[]
  ): Promise<{ available: boolean; reason?: string }> => {
    // Check public holidays
    const canton = user.location || 'BE';
    if (isUserOnHoliday(date, canton)) {
      const holidayForDate = holidays.find(h => {
        const holidayDate = new Date(h.date).toISOString().split('T')[0];
        return holidayDate === date && h.cantons.includes(canton);
      });
      return {
        available: false,
        reason: holidayForDate ? t('reasonHolidayWithName', { name: holidayForDate.name }) : t('reasonHoliday')
      };
    }

    // Check if user works this day
    if (!isUserWorkingOnDay(user, date, shift?.startTime)) {
      return { available: false, reason: t('reasonNotWorkingToday') };
    }

    // Check Out of Office (use override if provided, else state)
    const oofToCheck = oofEventsOverride ?? outOfOfficeEvents;
    if (oofToCheck.length > 0) {
      const availability = isUserAvailable(user, date, oofToCheck, shift);
      if (!availability.available) {
        return { available: false, reason: t('reasonOutOfOffice') };
      }
    }

    // Check consecutive shifts
    try {
      const response = await authFetch('/api/shift-assignments/check-consecutive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, date })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.hasConsecutiveShift) {
          const shiftNames = data.consecutiveAssignments.map((a: any) => a.shiftName).join(', ');
          return { available: false, reason: t('reasonConsecutiveShift', { shifts: shiftNames }) };
        }
      }
    } catch (error) {
    }

    return { available: true };
  };

  // Function to get eligible users for a shift
  const getEligibleUsersForShift = (shift: any, excludeUserId?: string): any[] => {
    if (!users) return [];

    const activeUsers = users.filter(u => u.status === 'ACTIVE' || u.status === 'active');

    // Team users (except those excluded from the shift and the current user)
    const teamUsers = activeUsers.filter(u =>
      u.teamId === shift.team?.id &&
      !(shift.excludedUserIds || []).includes(u.id) &&
      u.id !== excludeUserId
    );

    // Specifically included users (except the current user)
    const includedUsers = activeUsers.filter(u =>
      (shift.includedUserIds || []).includes(u.id) &&
      u.id !== excludeUserId
    );

    // Combine and deduplicate
    const allEligible = [...teamUsers, ...includedUsers];
    const uniqueEligible = Array.from(new Map(allEligible.map(u => [u.id, u])).values());

    return uniqueEligible;
  };

  // Effect to calculate user availability when the modal opens
  React.useEffect(() => {
    if (!resendingAssignment) {
      setUsersAvailability({ available: [], alreadyAssigned: [], unavailable: [] });
      setOutOfOfficeEvents([]);
      return;
    }

    const calculateAvailability = async () => {
      setCheckingAvailability(true);

      try {
        // Normalize date to YYYY-MM-DD for constraint checks
        const rawDate = resendingAssignment.date;
        const d = new Date(rawDate);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const eligibleUsers = getEligibleUsersForShift(
          resendingAssignment.shift,
          resendingAssignment.userId
        );

        // Fetch Out of Office using getSchedule API with eligible user emails
        const eligibleEmails = eligibleUsers.filter(u => u.email).map(u => u.email);
        const oofEvents = await fetchOutOfOfficeForDate(dateStr, eligibleEmails);
        setOutOfOfficeEvents(oofEvents);

        // Check which users are already assigned that day
        const assignedToday = assignments.filter(
          a => a.date === resendingAssignment.date && a.id !== resendingAssignment.id
        );

        const available: any[] = [];
        const alreadyAssigned: any[] = [];
        const unavailable: Array<{ user: any; reason: string }> = [];

        for (const user of eligibleUsers) {
          // Check if already assigned today
          const hasOtherShift = assignedToday.some(a => a.userId === user.id);

          if (hasOtherShift) {
            alreadyAssigned.push(user);
            continue;
          }

          // Check other constraints (pass oofEvents directly since state isn't updated yet)
          const availability = await checkUserAvailability(
            user,
            resendingAssignment.shift,
            dateStr,
            resendingAssignment.id,
            oofEvents
          );

          if (availability.available) {
            available.push(user);
          } else {
            unavailable.push({ user, reason: availability.reason || t('notAvailable') });
          }
        }

        setUsersAvailability({ available, alreadyAssigned, unavailable });
      } catch (error) {
        // Error calculating availability - handled by UI state
      } finally {
        setCheckingAvailability(false);
      }
    };

    calculateAvailability();
  }, [resendingAssignment, assignments, users]);

  // Function to resend the invitation to a new user
  const handleResend = async () => {
    if (!resendingAssignment || !selectedNewUser) return;

    setResending(true);

    try {
      const newUser = users?.find(u => u.id === selectedNewUser);
      if (!newUser) throw new Error(t('userNotFound'));

      // 1. Create the Outlook event via server-side API (application permissions)
      // so the organizer is the shared mailbox, not the admin user
      const shift = resendingAssignment.shift;
      const date = new Date(resendingAssignment.date);

      const [startHour, startMinute] = (shift.startTime || '00:00').split(':');
      const [endHour, endMinute] = (shift.endTime || '23:59').split(':');

      const startDateTime = new Date(date);
      startDateTime.setHours(parseInt(startHour), parseInt(startMinute), 0);

      const endDateTime = new Date(date);
      endDateTime.setHours(parseInt(endHour), parseInt(endMinute), 0);

      if (endDateTime <= startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1);
      }

      const mailbox = shift.senderMailbox || 'me';

      const event = {
        subject: shift.name,
        body: {
          contentType: 'HTML',
          content: `
            <h2>${shift.name}</h2>
            <p><strong>${t('invitationEmailDate')}</strong> ${date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p><strong>${t('invitationEmailSchedule')}</strong> ${shift.startTime} - ${shift.endTime}</p>
            ${shift.description ? `<p><strong>${t('invitationEmailDescription')}</strong> ${shift.description}</p>` : ''}
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
          displayName: shift.location || newUser.location || t('notSpecified')
        },
        isReminderOn: true,
        reminderMinutesBeforeStart: 1440,
        responseRequested: true,
        allowNewTimeProposals: false,
        showAs: 'busy',
        categories: ['Shift', shift.name]
      };

      // Send via server-side API route (uses application permissions)
      const outlookResponse = await authFetch('/api/outlook/send-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mailbox, event })
      });

      if (!outlookResponse.ok) {
        const errorBody = await outlookResponse.json().catch(() => ({}));
        throw new Error(errorBody?.graphError || errorBody?.error || t('outlookSendError'));
      }

      const createdEvent = await outlookResponse.json();

      // 2. Mark the old assignment as "resent"
      const patchResponse = await authFetch(`/api/shift-assignments/${resendingAssignment.id}`, {
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

      // 3. Create the new assignment in the DB
      const createResponse = await authFetch('/api/shift-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignments: [{
            date: resendingAssignment.date,
            shiftId: shift.id,
            userId: newUser.id,
            status: 'PENDING'
          }]
        })
      });

      if (!createResponse.ok) {
        throw new Error(t('createError'));
      }

      // 3b. Set the outlookEventId on the new assignment
      const createResult = await createResponse.json();
      const newAssignment = createResult.assignments?.find((a: any) => a.userId === newUser.id);
      if (newAssignment) {
        await authFetch(`/api/shift-assignments/${newAssignment.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outlookEventId: createdEvent.eventId })
        });
      }

      // 4. Delete the old Outlook event if it exists via server-side API
      if (resendingAssignment.outlookEventId) {
        try {
          await authFetch('/api/outlook/send-event', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mailbox,
              eventId: resendingAssignment.outlookEventId
            })
          });
        } catch {
          // Failed to delete old event - continue with resend
        }
      }

      // Refresh data
      await refresh();

      setSyncMessage({
        type: 'success',
        text: t('resendSuccess', { name: `${newUser.firstName} ${newUser.lastName}` })
      });
      setTimeout(() => setSyncMessage(null), 5000);

      // Close the modal
      setResendingAssignment(null);
      setSelectedNewUser(null);

    } catch (error) {
      // Resend error - notification shown to user
      setSyncMessage({
        type: 'error',
        text: error instanceof Error ? error.message : t('resendError')
      });
      setTimeout(() => setSyncMessage(null), 5000);
    } finally {
      setResending(false);
    }
  };

  // Function to sync with Outlook via server-side cron route (uses application permissions)
  const syncOutlook = async () => {
    setSyncing(true);
    setSyncMessage(null);

    try {
      // Call the server-side cron sync route which uses application permissions
      // This can read events from shared mailboxes via /users/{mailbox}/events
      const syncResponse = await authFetch('/api/outlook/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!syncResponse.ok) {
        const errorBody = await syncResponse.json().catch(() => ({}));
        throw new Error(errorBody?.error || 'Sync failed');
      }

      const result = await syncResponse.json();

      // Refresh dashboard data
      await refresh();

      setSyncMessage({
        type: 'success',
        text: t('syncSuccess', { count: result.updated || 0 })
      });
      setTimeout(() => setSyncMessage(null), 5000);
    } catch (err) {
      setSyncMessage({
        type: 'error',
        text: `${t('syncError')}: ${err instanceof Error ? err.message : ''}`
      });
      setTimeout(() => setSyncMessage(null), 10000);
    } finally {
      setSyncing(false);
    }
  };

  // Calculate user statistics with all details
  const userStatsWithDetails = useMemo(() => {
    if (!userStats || !users) return [];

    return userStats.map(stat => {
      const user = users.find(u => u.id === stat.userId);
      const userAssignments = assignments.filter(a => a.userId === stat.userId);

      return {
        ...stat,
        user,
        assignments: userAssignments
      };
    }).filter(stat => stat.user); // Filter out users not found
  }, [userStats, users, assignments]);

  // Filter assignments based on all filters
  const filteredAssignments = useMemo(() => {
    let filtered = [...assignments];

    // Filter by user
    if (selectedUser !== 'all') {
      filtered = filtered.filter(a => a.userId === selectedUser);
    }

    // Filter by shift
    if (selectedShift !== 'all') {
      filtered = filtered.filter(a => a.shift?.id === selectedShift);
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(a => a.status === selectedStatus);
    }

    // Filter by date - normalize dates for comparison
    if (selectedDate) {
      filtered = filtered.filter(a => {
        // Normalize the assignment date to YYYY-MM-DD format
        const assignmentDate = new Date(a.date).toISOString().split('T')[0];
        return assignmentDate === selectedDate;
      });
    }

    // Sort by date
    if (sortByDate) {
      filtered.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortByDate === 'asc' ? dateA - dateB : dateB - dateA;
      });
    }

    return filtered;
  }, [assignments, selectedUser, selectedShift, selectedStatus, selectedDate, sortByDate]);

  // Calculate total pages
  const totalPages = useMemo(() => {
    return Math.ceil(filteredAssignments.length / itemsPerPage);
  }, [filteredAssignments.length]);

  // Paginated assignments
  const paginatedAssignments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAssignments.slice(startIndex, endIndex);
  }, [filteredAssignments, currentPage]);

  // For compatibility with the rest of the code
  const recentAssignments = paginatedAssignments;

  const getStatusBadge = (status: string) => {
    const configs = {
      ACCEPTED: { label: t('statusAccepted'), color: 'bg-green-100 text-green-800' },
      REFUSED: { label: t('statusRefused'), color: 'bg-red-100 text-red-800' },
      PENDING: { label: t('statusPending'), color: 'bg-orange-100 text-orange-800' },
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
      PENDING: t('statusPending'),
      CANCELLED: t('statusCancelled')
    };
    return configs[status as keyof typeof configs] || t('statusPending');
  };

  const handleExport = () => {
    if (selectedView === 'shifts') {
      // Export recent shifts
      const csvContent = [
        [t('user'), t('team'), t('shift'), t('schedule'), t('date'), t('status')].join(';'),
        ...assignments.map(assignment => [
          `${assignment.user.firstName} ${assignment.user.lastName}`,
          assignment.user.team?.name || tCommon('noTeam'),
          assignment.shift.name,
          `${assignment.shift.startTime} - ${assignment.shift.endTime}`,
          new Date(assignment.date).toLocaleDateString('fr-FR'),
          getStatusLabel(assignment.status)
        ].join(';'))
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `dashboard_shifts_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Export user statistics
      const csvContent = [
        [t('user'), t('team'), t('totalShifts'), t('accepted'), t('pending'), t('refused'), t('cancelled'), t('acceptanceRate')].join(';'),
        ...userStatsWithDetails.map(userStat => {
          const acceptanceRate = userStat.total > 0
            ? Math.round((userStat.accepted / userStat.total) * 100)
            : 0;
          return [
            `${userStat.user?.firstName} ${userStat.user?.lastName}`,
            userStat.user?.team?.name || tCommon('noTeam'),
            userStat.total,
            userStat.accepted,
            userStat.pending,
            userStat.refused,
            userStat.cancelled,
            `${acceptanceRate}%`
          ].join(';');
        })
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `dashboard_utilisateurs_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
        {/* Sync message */}
        {syncMessage && (
          <Card className={`border-0 ${syncMessage.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {syncMessage.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                <p className={`text-sm font-medium ${syncMessage.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                  {syncMessage.text}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

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

            <Button variant="outline" size="sm" onClick={handleExport} className="hover:bg-secondary/20">
              <Download className="w-4 h-4 mr-2" />
              {tCommon('export')}
            </Button>
          </div>
        </div>

        {/* Filter by team */}
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Filter className="w-5 h-5 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">{t('filterByTeam')}</span>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger className="w-auto">
                  <Building2 className="w-4 h-4 mr-2 text-slate-500" />
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

        {/* Stats Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="bg-white border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="animate-pulse">
                    <div className="h-4 bg-slate-200 rounded w-24 mb-3"></div>
                    <div className="h-8 bg-slate-200 rounded w-16"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              icon={CheckCircle}
              title={t('shiftsAccepted')}
              value={stats.accepted}
              color="text-green-600"
            />
            <StatCard
              icon={XCircle}
              title={t('shiftsRefused')}
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
              icon={TrendingUp}
              title={t('totalShifts')}
              value={stats.total}
              color="text-blue-600"
            />
          </div>
        )}

        {/* Tabs for different views */}
        <Tabs value={selectedView} onValueChange={(v) => setSelectedView(v as any)} className="space-y-4">
          <TabsList>
            <TabsTrigger value="shifts" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {t('recentShifts')}
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              {t('byUser')}
            </TabsTrigger>
          </TabsList>

          {/* Recent Shifts View */}
          <TabsContent value="shifts">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <div>
                  <CardTitle className="text-xl font-semibold text-slate-800">
                    {t('recentShifts')}
                  </CardTitle>
                  <p className="text-sm text-slate-600 mt-1">
                    {t('recentShiftsSubtitle')}
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

                    {/* Filter by shift */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-slate-600">{t('shiftFilter')}</label>
                      <Select value={selectedShift} onValueChange={setSelectedShift}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('allFilter')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('allFilter')}</SelectItem>
                          {shifts?.map(shift => (
                            <SelectItem key={shift.id} value={shift.id}>
                              {shift.name}
                            </SelectItem>
                          ))}
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
                          <SelectItem value="PENDING">{t('statusPending')}</SelectItem>
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
                      {t('noShiftsSent')}
                    </h3>
                    <p className="text-slate-600 mb-6">
                      {t('noShiftsSentDesc')}
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
                            <th className="text-left text-slate-600 font-medium py-3 px-2">{t('shift')}</th>
                            <th
                              className="text-left text-slate-600 font-medium py-3 px-2 cursor-pointer select-none hover:text-slate-900 transition-colors"
                              onClick={() => setSortByDate(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc')}
                            >
                              <span className="inline-flex items-center gap-1">
                                {t('date')}
                                {sortByDate === 'asc' && <span className="text-blue-600">↑</span>}
                                {sortByDate === 'desc' && <span className="text-blue-600">↓</span>}
                                {!sortByDate && <span className="text-slate-400">↕</span>}
                              </span>
                            </th>
                            <th className="text-left text-slate-600 font-medium py-3 px-2">{t('status')}</th>
                            <th className="text-left text-slate-600 font-medium py-3 px-2">{t('actions')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentAssignments.map((assignment) => {
                            return (
                            <tr key={assignment.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                              <td className="py-4 px-2">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center">
                                    <span className="text-white text-sm font-medium">
                                      {assignment.user.firstName[0]}{assignment.user.lastName[0]}
                                    </span>
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
                                  <p className="font-medium text-slate-800">{assignment.shift.name}</p>
                                  <p className="text-xs text-slate-500">
                                    {assignment.shift.startTime} - {assignment.shift.endTime}
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
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
                      <p className="text-sm text-slate-600">
                        {t('pageOf', { current: currentPage, total: totalPages })} • {t('results', { count: filteredAssignments.length })}
                      </p>

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

                        <div className="grid grid-cols-4 gap-3">
                          <div className="text-center p-2 bg-green-50 rounded-lg">
                            <p className="text-lg font-semibold text-green-700">{userStat.accepted}</p>
                            <p className="text-xs text-green-600">{t('accepted')}</p>
                          </div>
                          <div className="text-center p-2 bg-orange-50 rounded-lg">
                            <p className="text-lg font-semibold text-orange-700">{userStat.pending}</p>
                            <p className="text-xs text-orange-600">{t('pending')}</p>
                          </div>
                          <div className="text-center p-2 bg-red-50 rounded-lg">
                            <p className="text-lg font-semibold text-red-700">{userStat.refused}</p>
                            <p className="text-xs text-red-600">{t('refused')}</p>
                          </div>
                          <div className="text-center p-2 bg-gray-50 rounded-lg">
                            <p className="text-lg font-semibold text-gray-700">{userStat.cancelled}</p>
                            <p className="text-xs text-gray-600">{t('cancelled')}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

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
                shift: resendingAssignment?.shift?.name || '',
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
                          const otherAssignment = assignments.find(
                            a => a.date === resendingAssignment?.date &&
                                 a.userId === user.id &&
                                 a.id !== resendingAssignment?.id
                          );
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
                                    {otherAssignment?.shift?.name || t('otherShift')}
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
    </div>
  );
};

export default function DashboardPageProtected() {
  return <ProtectedRoute><DashboardPage /></ProtectedRoute>;
}
