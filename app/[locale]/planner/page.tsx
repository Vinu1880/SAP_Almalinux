'use client';
//app/planner/page.tsx

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navigation from '@/components/Navigation';
import {
  Calendar,
  Clock,
  Users,
  Eye,
  EyeOff,
  Send,
  AlertCircle,
  CheckCircle,
  XCircle,
  Save,
  Mail,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarRange,
  Info,
  Settings,
  RotateCw,
  Maximize2,
  Shield,
  Link2,
  Edit,
  Scissors,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRotationPatterns } from '@/contexts/RotationPatternsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

// Import hooks
import { useAuth } from '@/contexts/AuthContext';
import { useShifts } from '@/lib/hooks/useShifts';
import { useUsers } from '@/lib/hooks/useUsers';
import { useTeams } from '@/lib/hooks/useTeams';
import { usePiketts } from '@/lib/hooks/usePiketts';
import { useHolidays } from '@/lib/hooks/useHolidays';
import { useAuthFetch, useAuthReady } from '@/lib/hooks/useAuthFetch';
import { useTranslations, useLocale } from 'next-intl';

// Types
interface OutlookEvent {
  id?: string;
  subject: string;
  start: { dateTime: string; timeZone?: string; };
  end: { dateTime: string; timeZone?: string; };
  showAs: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere';
  isAllDay: boolean;
  organizer?: { emailAddress: { name: string; address: string; }; };
  attendees?: any[];
  location?: { displayName: string; };
  body?: { content: string; contentType: string; };
  categories?: string[];
  calendarName?: string;
  calendarId?: string;
}

interface ShiftAssignment {
  date: string;
  shiftId: string;
  shift?: any;
  assignedUsers: any[];
  availableUsers: any[];
  unavailableUsers: Array<{
    user: any;
    reason: string;
    conflictEvents: OutlookEvent[];
  }>;
  isRotationAssignment?: boolean;
  isPikett?: boolean;
  isManualOverride?: boolean;
  overrideReason?: string;
  noAssignmentReason?: string;
  isDoubleShift?: boolean;
  isDoubleShiftTrigger?: boolean;
  // Split slot: set once the admin cuts a preview row into time segments.
  segmentStart?: string;
  segmentEnd?: string;
  segmentGroupId?: string;
  segmentIndex?: number;
}

const PlannerPage = () => {
  const t = useTranslations('planner');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const { piketts } = usePiketts();
  const { holidays, isUserOnHoliday, loading: holidaysLoading } = useHolidays();

  // State
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
  const [selectedPiketts, setSelectedPiketts] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isProcessingShifts, setIsProcessingShifts] = useState(false);
  const [outOfOfficeEvents, setOutOfOfficeEvents] = useState<OutlookEvent[]>([]);
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [selectedDayAssignments, setSelectedDayAssignments] = useState<ShiftAssignment[] | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [splittingPreview, setSplittingPreview] = useState<ShiftAssignment | null>(null);
  const [previewSegments, setPreviewSegments] = useState<Array<{ start: string; end: string; userId: string }>>([]);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [randomSeed, setRandomSeed] = useState(() => Date.now());
  const [expandedCalendar, setExpandedCalendar] = useState(false);
  const [showConfiguration, setShowConfiguration] = useState(true);
  const [showWeekendDays, setShowWeekendDays] = useState(true);
  const { patterns: rotationPatterns } = useRotationPatterns();
  const [editingAssignment, setEditingAssignment] = useState<string | null>(null);
  const [tempAssignedUser, setTempAssignedUser] = useState<string | null>(null);
  const [expandedAssignmentUserId, setExpandedAssignmentUserId] = useState<string | null>(null);
  const [tempShiftAssignments, setTempShiftAssignments] = useState<ShiftAssignment[]>([]);
  const [dateError, setDateError] = useState<string>('');
  const [sendingInvitations, setSendingInvitations] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0, success: 0, errors: 0 });
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState<{
    outlookSuccess: number;
    outlookErrors: number;
    outlookErrorDetails?: string[];
    dbCount: number;
  } | null>(null);

  // Auth
  const { getAccessToken } = useAuth();
  const authFetch = useAuthFetch();
  const isAuthReady = useAuthReady();

  // DB assignments state (for status badges + fairness stats)
  const [dbAssignments, setDbAssignments] = useState<any[]>([]);
  const [dbPikettAssignments, setDbPikettAssignments] = useState<any[]>([]);

  // Hooks
  const { shifts, loading: shiftsLoading } = useShifts();
  const { users, loading: usersLoading } = useUsers();
  const { teams, loading: teamsLoading } = useTeams();

  // Fetch existing DB shift + pikett assignments for the current month
  const fetchDbAssignments = async () => {
    try {
      const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
      const startDateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-01`;
      const endDateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      const [shiftResp, pikettResp] = await Promise.all([
        authFetch(`/api/shift-assignments?startDate=${startDateStr}&endDate=${endDateStr}`),
        authFetch(`/api/pikett-assignments?startDate=${startDateStr}&endDate=${endDateStr}`),
      ]);
      if (shiftResp.ok) setDbAssignments(await shiftResp.json());
      if (pikettResp.ok) setDbPikettAssignments(await pikettResp.json());
    } catch (err) {
      // Silent - badges just won't render
    }
  };

  useEffect(() => {
    if (isAuthReady) {
      fetchDbAssignments();
    }
  }, [calendarMonth, calendarYear, isAuthReady]);

  // Helper: normalize DB date to YYYY-MM-DD (local timezone)
  const normalizeDbDate = (dateValue: string | Date): string => {
    const d = new Date(dateValue);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // Get the status of a date+shift combination. When userId is given, only that
  // user's row is considered — necessary when a shift was resent (multiple rows
  // exist and only the current assignee's status is relevant).
  const getDateShiftStatus = (date: string, shiftId: string, userId?: string): 'PENDING' | 'TENTATIVE' | 'ACCEPTED' | 'REFUSED' | 'CANCELLED' | null => {
    const matches = dbAssignments.filter((a: any) =>
      normalizeDbDate(a.date) === date &&
      a.shiftId === shiftId &&
      (!userId || a.userId === userId)
    );
    if (matches.length === 0) return null;
    if (matches.some((a: any) => a.status === 'ACCEPTED')) return 'ACCEPTED';
    if (matches.some((a: any) => a.status === 'REFUSED')) return 'REFUSED';
    if (matches.some((a: any) => a.status === 'TENTATIVE')) return 'TENTATIVE';
    if (matches.some((a: any) => a.status === 'CANCELLED')) return 'CANCELLED';
    return 'PENDING';
  };

  const defaultSettings = { balanceShifts: true, checkCalendars: true, respectWorkPercentage: true, prioritySystem: true, enableRotations: true };
  const loadSettings = () => {
    if (typeof window === 'undefined') return defaultSettings;
    try { const s = localStorage.getItem('shiftSettings'); return s ? JSON.parse(s) : defaultSettings; } catch { return defaultSettings; }
  };

  // Utility function to check if a user works on a given day
const isUserWorkingOnDay = (user: any, date: string, shiftTime?: string, shiftEndTime?: string): boolean => {
  if (!user.availability) return true;
  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay();

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayAvailability = user.availability[dayNames[dayOfWeek]];
  if (!dayAvailability) return true;

  // Assign based on where the majority of the shift falls (boundary = 13:00).
  if (shiftTime) {
    const [startH, startM] = shiftTime.split(':').map(Number);
    const startMinutes = startH * 60 + (startM || 0);
    const endMinutes = shiftEndTime
      ? parseInt(shiftEndTime.split(':')[0]) * 60 + (parseInt(shiftEndTime.split(':')[1]) || 0)
      : startMinutes;
    const midday = 13 * 60;

    if (endMinutes <= midday) return dayAvailability.morning === true;
    if (startMinutes >= midday) return dayAvailability.afternoon === true;

    const morningPortion = midday - startMinutes;
    const afternoonPortion = endMinutes - midday;
    const totalDuration = endMinutes - startMinutes;
    const minorPortion = Math.min(morningPortion, afternoonPortion);

    // If <25% of the shift falls in the minor half, treat it as a single-period shift.
    if (minorPortion / totalDuration < 0.25) {
      return afternoonPortion > morningPortion
        ? dayAvailability.afternoon === true
        : dayAvailability.morning === true;
    }
    // Both halves substantial → needs both.
    return dayAvailability.morning === true && dayAvailability.afternoon === true;
  }

  return dayAvailability.morning === true || dayAvailability.afternoon === true;
};

  const [settings, setSettings] = useState(() => loadSettings());

  const validateDates = (start: string, end: string): string => {
    if (!start || !end) return '';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDateObj = new Date(start);
    const endDateObj = new Date(end);

    if (startDateObj > endDateObj) return t('startDateCannotBeAfterEnd');
    if (startDateObj < today) return t('startDateCannotBeInPast');
    if (endDateObj < today) return t('endDateCannotBeInPast');
    return '';
  };

  // Improved rotation function
  const getRotationShiftForUserOnDate = (
    userId: string,
    date: string,
    user: any
  ): string | null => {
    if (!settings.enableRotations || !user.rotationConfig?.patternId) {
      return null;
    }

    const pattern = rotationPatterns.find(p => p.id === user.rotationConfig.patternId);
    if (!pattern) return null;

    // Use ISO week number so multi-month generations stay in sync with the cycle.
    const currentDateObj = new Date(date);
    const tmp = new Date(currentDateObj.valueOf());
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const isoWeekNum = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

    const weekInCycle = (isoWeekNum - 1) % pattern.cycleLength;
    const weekPattern = pattern.weeks[weekInCycle];
    if (!weekPattern) return null;

    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][currentDateObj.getDay()];
    const shiftIds = weekPattern[dayOfWeek] || [];

    return shiftIds[0] || null;
  };

  // Deterministic Fisher-Yates shuffle (mulberry32 seeded by djb2(seed + salt)).
  const shuffleArray = <T,>(array: T[], seed: number, additionalSeed: string = ''): T[] => {
    const shuffled = [...array];
    let currentIndex = shuffled.length;

    const hashCode = (str: string): number => {
      let hash = 5381;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
      }
      return Math.abs(hash);
    };

    let state = (seed + hashCode(additionalSeed)) | 0;
    const random = () => {
      state = (state + 0x6D2B79F5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    while (currentIndex !== 0) {
      const randomIndex = Math.floor(random() * currentIndex);
      currentIndex--;
      [shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
    }

    return shuffled;
  };

  const mapDbUser = (u: any) => ({
    id: u.id, email: u.email, displayName: `${u.firstName} ${u.lastName}`,
    firstName: u.firstName, lastName: u.lastName, workPercent: u.workPercent ?? 100,
    status: u.status, rotationConfig: u.rotationConfig || null, teamId: u.teamId || null,
    availability: u.availability || null, role: u.role || null, location: u.location || null,
    rules: u.rules || []
  });

  const fetchUsersFromCalendars = async (): Promise<any[]> => {
    const allUsers = users.map(mapDbUser);
    setAvailableUsers(allUsers);
    return allUsers;
  };

  // Split a preview row before anything is sent. Purely local: the segments
  // become separate rows in shiftAssignments and are persisted on send.
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  const openPreviewSplit = (assignment: ShiftAssignment) => {
    const start = (assignment.shift?.startTime || '08:00').slice(0, 5);
    const end = (assignment.shift?.endTime || '17:00').slice(0, 5);
    const mid = toHHMM(Math.round((toMin(start) + toMin(end)) / 2 / 30) * 30);
    setPreviewSegments([
      { start, end: mid, userId: assignment.assignedUsers[0]?.id || '' },
      { start: mid, end, userId: '' },
    ]);
    setSplittingPreview(assignment);
  };

  const updatePreviewSegment = (index: number, patch: Partial<{ start: string; end: string; userId: string }>) => {
    setPreviewSegments(prev => {
      const next = prev.map((s, i) => (i === index ? { ...s, ...patch } : s));
      if (patch.end !== undefined && index < next.length - 1) {
        next[index + 1] = { ...next[index + 1], start: patch.end };
      }
      if (patch.start !== undefined && index > 0) {
        next[index - 1] = { ...next[index - 1], end: patch.start };
      }
      return next;
    });
  };

  const addPreviewSegment = () => {
    setPreviewSegments(prev => {
      const last = prev[prev.length - 1];
      const mid = toHHMM(Math.round((toMin(last.start) + toMin(last.end)) / 2 / 30) * 30);
      if (mid === last.start || mid === last.end) return prev;
      return [...prev.slice(0, -1), { ...last, end: mid }, { start: mid, end: last.end, userId: '' }];
    });
  };

  const removePreviewSegment = (index: number) => {
    setPreviewSegments(prev => {
      if (prev.length <= 2) return prev;
      const next = prev.filter((_, i) => i !== index);
      if (index === 0) next[0] = { ...next[0], start: prev[0].start };
      else next[index - 1] = { ...next[index - 1], end: prev[index].end };
      return next;
    });
  };

  const applyPreviewSplit = () => {
    if (!splittingPreview) return;
    const groupId = `preview-${Date.now()}`;
    const rows: ShiftAssignment[] = previewSegments.map((seg, i) => ({
      ...splittingPreview,
      assignedUsers: [availableUsers.find(u => u.id === seg.userId)].filter(Boolean),
      segmentStart: seg.start,
      segmentEnd: seg.end,
      segmentGroupId: groupId,
      segmentIndex: i + 1,
    }));

    const replaceRow = (list: ShiftAssignment[]) => {
      const out: ShiftAssignment[] = [];
      for (const a of list) {
        if (a.date === splittingPreview.date && a.shiftId === splittingPreview.shiftId && !a.segmentGroupId) {
          out.push(...rows);
        } else {
          out.push(a);
        }
      }
      return out;
    };

    setShiftAssignments(prev => replaceRow(prev));
    setTempShiftAssignments(prev => replaceRow(prev));
    setSelectedDayAssignments(prev => (prev ? replaceRow(prev) : prev));
    setSplittingPreview(null);
  };

  const undoPreviewSplit = (groupId: string) => {
    const restore = (list: ShiftAssignment[]) => {
      const segs = list.filter(a => a.segmentGroupId === groupId);
      if (segs.length === 0) return list;
      const base = segs[0];
      const merged: ShiftAssignment = {
        ...base,
        assignedUsers: base.assignedUsers,
        segmentStart: undefined,
        segmentEnd: undefined,
        segmentGroupId: undefined,
        segmentIndex: undefined,
      };
      const out: ShiftAssignment[] = [];
      let inserted = false;
      for (const a of list) {
        if (a.segmentGroupId === groupId) {
          if (!inserted) { out.push(merged); inserted = true; }
        } else {
          out.push(a);
        }
      }
      return out;
    };
    setShiftAssignments(prev => restore(prev));
    setTempShiftAssignments(prev => restore(prev));
    setSelectedDayAssignments(prev => (prev ? restore(prev) : prev));
  };

  const handleSaveAssignmentChange = (assignmentDate: string, assignmentShiftId: string) => {
  if (tempAssignedUser === null) return;
  
  const selectedUser = availableUsers.find(u => u.id === tempAssignedUser);
  if (!selectedUser) return;
  
  // Dialog view
  const updatedDayAssignments = selectedDayAssignments?.map(a => {
    if (a.date === assignmentDate && a.shiftId === assignmentShiftId) {
      const originalAssignment = shiftAssignments.find(orig =>
        orig.date === assignmentDate && orig.shiftId === assignmentShiftId
      );
      const originalConstraint = a.unavailableUsers.find(u =>
        u.user.id === tempAssignedUser &&
        u.reason !== t('reasonAlreadyAssignedToday')
      );
      const hasOtherShift = selectedDayAssignments.some(other =>
        other.shiftId !== assignmentShiftId &&
        other.assignedUsers.some(u => u.id === tempAssignedUser)
      );
      const originalUserId = originalAssignment?.assignedUsers[0]?.id;
      const isChanged = originalUserId !== tempAssignedUser;

      return {
        ...a,
        assignedUsers: selectedUser ? [selectedUser] : [],
        isManualOverride: isChanged || originalConstraint || hasOtherShift ? true : false,
        overrideReason: isChanged ? t('manualModification') :
                       originalConstraint ? originalConstraint.reason :
                       hasOtherShift ? t('alreadyAssignedToAnotherShift') :
                       undefined,
        unavailableUsers: a.unavailableUsers
      };
    }
    return a;
  });

  // Persisted list (must handle both shifts and piketts).
  const updatedTempAssignments = tempShiftAssignments.map(a => {
    if (a.date === assignmentDate && a.shiftId === assignmentShiftId) {
      const originalAssignment = shiftAssignments.find(orig =>
        orig.date === assignmentDate && orig.shiftId === assignmentShiftId
      );
      const originalConstraint = a.unavailableUsers.find(u =>
        u.user.id === tempAssignedUser &&
        u.reason !== t('reasonAlreadyAssignedToday')
      );
      const hasOtherShift = updatedDayAssignments?.some(other =>
        other.date === assignmentDate &&
        other.shiftId !== assignmentShiftId &&
        other.assignedUsers.some(u => u.id === tempAssignedUser)
      );
      const originalUserId = originalAssignment?.assignedUsers[0]?.id;
      const isChanged = originalUserId !== tempAssignedUser;

      return {
        ...a,
        assignedUsers: selectedUser ? [selectedUser] : [],
        isManualOverride: isChanged || originalConstraint || hasOtherShift ? true : false,
        overrideReason: isChanged ? t('manualModification') :
                       originalConstraint ? originalConstraint.reason :
                       hasOtherShift ? t('alreadyAssignedToAnotherShift') :
                       undefined,
        unavailableUsers: a.unavailableUsers,
        isPikett: a.isPikett,
        shift: a.shift
      };
    }
    return a;
  });
  
  setSelectedDayAssignments(updatedDayAssignments || []);
  setTempShiftAssignments(updatedTempAssignments);
  setEditingAssignment(null);
  setTempAssignedUser(null);
};

  const fetchOutOfOfficeForPeriod = async (): Promise<OutlookEvent[]> => {
    if (!startDate || !endDate) {
      return [];
    }

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        // No Graph token: fall back to OOF events stored in the local DB.
        try {
          const resp = await authFetch(`/api/out-of-office?start=${startDate}&end=${endDate}`);
          if (resp.ok) return await resp.json();
        } catch {}
        return [];
      }

      const allOutOfOfficeEvents: OutlookEvent[] = [];
      const userEmails = availableUsers.filter(u => u.email).map(u => u.email);
      if (userEmails.length === 0) return [];

      // Graph getSchedule caps windows at ~62 days → split into 60-day chunks.
      const CHUNK_DAYS = 60;
      const rangeChunks: Array<{ start: string; end: string }> = [];
      {
        const globalStart = new Date(startDate + 'T00:00:00');
        const globalEnd = new Date(endDate + 'T00:00:00');
        let cursor = new Date(globalStart);
        while (cursor.getTime() <= globalEnd.getTime()) {
          const chunkEnd = new Date(cursor);
          chunkEnd.setDate(chunkEnd.getDate() + CHUNK_DAYS - 1);
          const effectiveEnd = chunkEnd.getTime() > globalEnd.getTime() ? globalEnd : chunkEnd;
          const fmtDay = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          rangeChunks.push({ start: fmtDay(cursor), end: fmtDay(effectiveEnd) });
          cursor = new Date(effectiveEnd);
          cursor.setDate(cursor.getDate() + 1);
        }
      }

      // Use Graph getSchedule API to check availability of all users at once
      // Process in batches of 20 (Graph API limit) x N chunks
      const batchSize = 20;
      for (const chunk of rangeChunks) {
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
              dateTime: chunk.start + 'T00:00:00',
              timeZone: 'Europe/Zurich'
            },
            endTime: {
              dateTime: chunk.end + 'T23:59:59',
              timeZone: 'Europe/Zurich'
            },
            availabilityViewInterval: 60
          })
        });

        if (!scheduleResponse.ok) {
          return await fetchOutOfOfficeFromOwnCalendar();
        }

        const scheduleData = await scheduleResponse.json();

        for (const userSchedule of scheduleData.value) {
          const userEmail = userSchedule.scheduleId?.toLowerCase() || '';
          if (!userSchedule.scheduleItems) continue;

          for (const item of userSchedule.scheduleItems) {
            if (item.status === 'oof' || item.status === 'busy') {
              // Graph returns exclusive midnight-end for all-day OOF; shift it
              // back to 23:59:59 of the previous day only in that form.
              let adjustedEnd = item.end.dateTime;
              const endStr = item.end.dateTime as string;
              const isMidnight = /T00:00(:00)?(\.\d+)?$/.test(endStr);
              if (isMidnight) {
                const endDt = new Date(endStr);
                endDt.setDate(endDt.getDate() - 1);
                adjustedEnd = `${endDt.getFullYear()}-${String(endDt.getMonth() + 1).padStart(2, '0')}-${String(endDt.getDate()).padStart(2, '0')}T23:59:59`;
              }

              allOutOfOfficeEvents.push({
                id: `schedule-${userEmail}-${item.start.dateTime}`,
                subject: item.subject || (item.status === 'oof' ? 'Out of Office' : 'Busy'),
                start: { dateTime: item.start.dateTime },
                end: { dateTime: adjustedEnd },
                showAs: item.status as 'oof' | 'busy',
                isAllDay: false,
                organizer: { emailAddress: { address: userEmail, name: '' } },
                attendees: [{ emailAddress: { address: userEmail, name: '' } }]
              });
            }
          }
        }
      }
      }

      return allOutOfOfficeEvents;
    } catch (error) {
      return [];
    }
  };

  // Fallback path when getSchedule fails — /me/calendars filtered to shift members.
  const fetchOutOfOfficeFromOwnCalendar = async (): Promise<OutlookEvent[]> => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken || !startDate || !endDate) return [];

      const eligibleEmails = new Set(
        availableUsers
          .filter(u => u.email)
          .map(u => u.email.toLowerCase())
      );

      if (eligibleEmails.size === 0) return [];

      const startDateTime = new Date(startDate + 'T00:00:00').toISOString();
      const endDateTime = new Date(endDate + 'T23:59:59').toISOString();
      const allOutOfOfficeEvents: OutlookEvent[] = [];

      const calendarsResponse = await fetch('https://graph.microsoft.com/v1.0/me/calendars', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!calendarsResponse.ok) return [];
      const calendarsData = await calendarsResponse.json();

      for (const calendar of calendarsData.value) {
        try {
          const eventsUrl = `https://graph.microsoft.com/v1.0/me/calendars/${calendar.id}/events?` +
            `$select=subject,start,end,showAs,isAllDay,organizer,attendees` +
            `&$filter=start/dateTime le '${endDateTime}' and end/dateTime ge '${startDateTime}'`;

          const eventsResponse = await fetch(eventsUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'Prefer': 'outlook.timezone="Europe/Zurich"'
            }
          });

          if (eventsResponse.ok) {
            const eventsData = await eventsResponse.json();
            const oofEvents = eventsData.value.filter((event: OutlookEvent) => {
              if (event.showAs !== 'oof' && event.showAs !== 'busy') return false;
              // Keep only events where organizer or an attendee is a shift member.
              const organizerEmail = event.organizer?.emailAddress?.address?.toLowerCase() || '';
              const attendeeEmails = (event.attendees || []).map((a: any) =>
                a.emailAddress?.address?.toLowerCase() || ''
              );
              return eligibleEmails.has(organizerEmail) ||
                attendeeEmails.some((email: string) => eligibleEmails.has(email));
            });
            oofEvents.forEach((event: OutlookEvent) => {
              allOutOfOfficeEvents.push({ ...event, calendarName: calendar.name, calendarId: calendar.id });
            });
          }
        } catch {
          // Skip broken calendar.
        }
      }
      return allOutOfOfficeEvents;
    } catch (error) {
      return [];
    }
  };

  const generateDateRange = (start: string, end: string): string[] => {
    const dates: string[] = [];
    // Build from local y/m/d parts (avoid TZ-shift dropping the last day).
    const [sy, sm, sd] = start.split('-').map(Number);
    const [ey, em, ed] = end.split('-').map(Number);
    const startDateObj = new Date(sy, (sm || 1) - 1, sd || 1, 12);
    const endDateObj = new Date(ey, (em || 1) - 1, ed || 1, 12);

    for (let d = new Date(startDateObj.getTime()); d.getTime() <= endDateObj.getTime();) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12);
    }

    return dates;
  };

  // "2026-08-18T08:00:00" — a wall-clock stamp with no zone marker. Sent
  // alongside timeZone, it keeps a shift at 08:00 local whether Switzerland is
  // on CET or CEST, and regardless of the server's own zone.
  const localDateTime = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` +
    `T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;

  const HOLIDAY_KEYWORDS = /\b(ferien|holiday|holidays|vacances|urlaub|vacation|conges|congé|congés|absent|absence|sick|krank|malade|maladie|leave|off day|feiertag|feriado)\b/i;
  // Short OOF (< this many hours) is treated as a "busy" meeting — informational,
  // never blocking. Rationale: a 30-min "Namitalk" or lunch marked OOF must not
  // block a full-day shift.
  const SHORT_OOF_HOURS = 4;

  // True absence for shifts: keyword, all-day, ≥24h, or long declared OOF.
  const isTrueOOF = (event: OutlookEvent): boolean => {
    const subject = (event.subject || '').toLowerCase();
    if (HOLIDAY_KEYWORDS.test(subject)) return true;
    const start = new Date(event.start.dateTime).getTime();
    const end = new Date(event.end.dateTime).getTime();
    const durationHours = (end - start) / 3600000;
    if (event.isAllDay || durationHours >= 24) return true;
    return event.showAs === 'oof' && durationHours >= SHORT_OOF_HOURS;
  };

  // Stricter filter for piketts (24/7): only real vacations / all-day count.
  const isTrueOOFForPikett = (event: OutlookEvent): boolean => {
    const subject = (event.subject || '').toLowerCase();
    if (HOLIDAY_KEYWORDS.test(subject)) return true;
    const start = new Date(event.start.dateTime).getTime();
    const end = new Date(event.end.dateTime).getTime();
    const durationHours = (end - start) / 3600000;
    return event.isAllDay || durationHours >= 24;
  };


  const isUserAvailable = (user: any, date: string, oofEvents: OutlookEvent[], shift?: any, isPikettContext?: boolean) => {
  const userEmail = user.email.toLowerCase();
  const filterOOF = isPikettContext ? isTrueOOFForPikett : isTrueOOF;

  // If a shift is provided with times, check the exact hours
  // Otherwise, check the whole day (00:00-23:59)
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

  const overlapsWindow = (event: OutlookEvent) => {
    const eventStart = new Date(event.start.dateTime);
    const eventEnd = new Date(event.end.dateTime);
    const adjustedEventEnd = event.isAllDay ? new Date(eventEnd.getTime() - 1000) : eventEnd;
    return eventStart < dateEnd && adjustedEventEnd > dateStart;
  };
  const involvesUser = (event: OutlookEvent) => {
    const organizerEmail = event.organizer?.emailAddress?.address?.toLowerCase() || '';
    return organizerEmail === userEmail ||
      event.attendees?.some((attendee: any) =>
        attendee.emailAddress?.address?.toLowerCase() === userEmail);
  };

  const conflicts = oofEvents.filter(event =>
    involvesUser(event) && filterOOF(event) && overlapsWindow(event)
  );

  // Block only when OOF covers ≥50% of the shift window.
  let coversFullShift = false;
  if (conflicts.length > 0 && shift?.startTime && shift?.endTime) {
    const shiftDuration = dateEnd.getTime() - dateStart.getTime();
    const clipped = conflicts.map(evt => {
      const evtStart = new Date(evt.start.dateTime);
      const evtEnd = evt.isAllDay
        ? new Date(new Date(evt.end.dateTime).getTime() - 1000)
        : new Date(evt.end.dateTime);
      return {
        start: Math.max(evtStart.getTime(), dateStart.getTime()),
        end: Math.min(evtEnd.getTime(), dateEnd.getTime()),
      };
    }).sort((a, b) => a.start - b.start);
    const merged: Array<{ start: number; end: number }> = [];
    for (const r of clipped) {
      const last = merged[merged.length - 1];
      if (last && r.start <= last.end) {
        if (r.end > last.end) last.end = r.end;
      } else {
        merged.push({ ...r });
      }
    }
    const coveredMs = merged.reduce((sum, r) => sum + (r.end - r.start), 0);
    coversFullShift = coveredMs >= shiftDuration * 0.5;
  } else if (conflicts.length > 0 && !shift?.startTime) {
    coversFullShift = true;
  }

  const available = conflicts.length === 0;

  return {
    available,
    conflictEvents: conflicts,
    coversFullShift,
  };
};

  const getEligibleUsersForShift = (shift: any): any[] => {
    const teamUsers = availableUsers.filter(u =>
      u.teamId === shift.teamId &&
      (u.status === 'ACTIVE' || u.status === 'active') &&
      !(shift.excludedUserIds || []).includes(u.id)
    );

    const includedUsers = availableUsers.filter(u =>
      (shift.includedUserIds || []).includes(u.id) &&
      (u.status === 'ACTIVE' || u.status === 'active')
    );

    const seen = new Set<string>();
    const result: any[] = [];
    for (const u of [...teamUsers, ...includedUsers]) {
      if (!seen.has(u.id)) {
        seen.add(u.id);
        result.push(u);
      }
    }
    return result;
  };

  // Same eligibility logic as above but for non-active statuses.
  const getInactiveUsersForShift = (shift: any): any[] => {
    const teamUsers = availableUsers.filter(u =>
      u.teamId === shift.teamId &&
      u.status !== 'ACTIVE' && u.status !== 'active' &&
      !(shift.excludedUserIds || []).includes(u.id)
    );
    const includedUsers = availableUsers.filter(u =>
      (shift.includedUserIds || []).includes(u.id) &&
      u.status !== 'ACTIVE' && u.status !== 'active'
    );
    return [...teamUsers, ...includedUsers];
  };

  // Union of users eligible for any currently selected shift or pikett.
  const getSelectedShiftsMemberIds = (): Set<string> => {
    const memberIds = new Set<string>();
    for (const shiftId of selectedShifts) {
      const shift = shifts.find(s => s.id === shiftId);
      if (!shift) continue;
      availableUsers.forEach(u => {
        if (u.status !== 'ACTIVE' && u.status !== 'active') return;
        const inTeam = u.teamId === shift.teamId && !(shift.excludedUserIds || []).includes(u.id);
        const included = (shift.includedUserIds || []).includes(u.id);
        if (inTeam || included) memberIds.add(u.id);
      });
    }
    for (const pikettId of selectedPiketts) {
      const pikett = piketts.find(p => p.id === pikettId);
      if (!pikett) continue;
      availableUsers.forEach(u => {
        if (u.status !== 'ACTIVE' && u.status !== 'active') return;
        const inTeam = u.teamId === pikett.teamId && !(pikett.excludedUserIds || []).includes(u.id);
        const included = (pikett.includedUserIds || []).includes(u.id);
        if (inTeam || included) memberIds.add(u.id);
      });
    }
    return memberIds;
  };

const processShiftAssignments = async () => {
  if (selectedShifts.length === 0 && selectedPiketts.length === 0) {
    alert(t('selectAtLeastOneShift'));
    return;
  }

  if (!startDate || !endDate) {
    alert(t('selectDatesAndDays'));
    return;
  }

  setIsProcessingShifts(true);
  
  try {
    let currentUsers = availableUsers.length > 0 ? availableUsers : await fetchUsersFromCalendars();

    if (currentUsers.length === 0) {
      alert(t('noUsersFound'));
      setIsProcessingShifts(false);
      return;
    }
    
    const oofEvents = settings.checkCalendars ? await fetchOutOfOfficeForPeriod() : [];
    setOutOfOfficeEvents(oofEvents);
    
    const dates = generateDateRange(startDate, endDate);

    const assignments: ShiftAssignment[] = [];
    // Fairness counters (DB history + current run)
    const userShiftsTracking: { [userId: string]: { [shiftId: string]: number } } = {};
    const userAvailableDays: { [userId: string]: { [shiftId: string]: number } } = {};
    // MAX_LOAD counter — seeded from DB (annual) + current run.
    const userCurrentRunTracking: { [userId: string]: { [shiftId: string]: number } } = {};
    // Skip already-assigned DB slots
    const dbAlreadyAssigned = new Set<string>();
    // Pikett cross-generation state
    const pikettWeekCountFromDb = new Map<string, Map<string, number>>();
    const pikettWeekSeenFromDb = new Set<string>();
    const lastPikettWeekIndexFromDb = new Map<string, Map<string, number>>();
    const pikettWeekMembersFromDb = new Set<string>();
    // Prevent same user on same shift twice in one ISO week
    const weeklyAssignmentsFromDb: { [weekKey: string]: { [shiftId: string]: Set<string> } } = {};
    // "shiftId|userId|dow" → sorted list of ISO-week indexes where the user was
    // assigned this shift on this day-of-week (seeded from DB + updated during
    // the run). Used to spread same-day-of-week repeats across users.
    const shiftDowHistory = new Map<string, number[]>();

    const isoWeekOfDate = (dateStr: string): string => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const tmp = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
      const dayNum = tmp.getUTCDay() || 7;
      tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
      const yr = tmp.getUTCFullYear();
      const yearStart = new Date(Date.UTC(yr, 0, 1));
      const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      return `${yr}-W${weekNo.toString().padStart(2, '0')}`;
    };
    // Monotonic week index (safe across year boundaries).
    const weekKeyToIdx = (wk: string): number => {
      const [y, w] = wk.split('-W').map(Number);
      return y * 53 + w;
    };
    const normalizeDbDateStr = (raw: any): string => {
      const d = new Date(raw);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Fast-lookup sets used both to seed from DB and to track per-run assignments.
    // Seeding from DB is critical: without it, a shift already saved to DB (e.g.
    // Helpdesk on Monday) would not block another shift being added for the
    // same user on the same day in a later run (Priority 3 check).
    const assignedNormalShiftSet = new Set<string>();
    const assignedPikettSet = new Set<string>();
    const assignedAnyShiftSet = new Set<string>();
    const pikettWeekMemberSet = new Set<string>();

    // Snapshot DB over the WHOLE year of the planning range (Jan 1 → Dec 31 of
    // the year `endDate` belongs to) so fairness + MAX_LOAD counters reflect
    // the annual load — critical when planning in ~15 tranches over the year.
    try {
      const [ey] = String(endDate).split('-').map(Number);
      const lookbackStr = `${ey}-01-01`;
      const lookforwardStr = `${ey}-12-31`;
      const [pastShiftsResp, pastPikettsResp] = await Promise.all([
        authFetch(`/api/shift-assignments?startDate=${lookbackStr}&endDate=${lookforwardStr}`),
        authFetch(`/api/pikett-assignments?startDate=${lookbackStr}&endDate=${lookforwardStr}`),
      ]);
      const pastShifts: any[] = pastShiftsResp.ok ? await pastShiftsResp.json() : [];
      const pastPiketts: any[] = pastPikettsResp.ok ? await pastPikettsResp.json() : [];
      for (const a of pastShifts) {
        if (a.status === 'CANCELLED' || a.status === 'REFUSED') continue;
        const uid = a.userId;
        const sid = a.shiftId;
        if (!uid || !sid) continue;
        if (!userShiftsTracking[uid]) userShiftsTracking[uid] = {};
        userShiftsTracking[uid][sid] = (userShiftsTracking[uid][sid] || 0) + 1;
        // Seed MAX_LOAD counter so an annual cap is respected across tranches.
        if (!userCurrentRunTracking[uid]) userCurrentRunTracking[uid] = {};
        userCurrentRunTracking[uid][sid] = (userCurrentRunTracking[uid][sid] || 0) + 1;
        const dateStr = normalizeDbDateStr(a.date);
        dbAlreadyAssigned.add(`${dateStr}|${sid}`);
        // Seed the fast-lookup sets so Priority 3 (already-assigned-today) blocks
        // this user from getting another shift on the same day.
        if (dateStr >= startDate && dateStr <= endDate) {
          assignedNormalShiftSet.add(`${dateStr}|${uid}`);
          assignedAnyShiftSet.add(`${dateStr}|${uid}`);
        }
        const wk = isoWeekOfDate(dateStr);
        if (!weeklyAssignmentsFromDb[wk]) weeklyAssignmentsFromDb[wk] = {};
        if (!weeklyAssignmentsFromDb[wk][sid]) weeklyAssignmentsFromDb[wk][sid] = new Set();
        weeklyAssignmentsFromDb[wk][sid].add(uid);
        // Track same-day-of-week history so the sort can spread repeats.
        const dow = new Date(dateStr).getDay();
        const dowKey = `${sid}|${uid}|${dow}`;
        const list = shiftDowHistory.get(dowKey) || [];
        list.push(weekKeyToIdx(wk));
        shiftDowHistory.set(dowKey, list);
        // Surface the DB row in the preview only for shifts that were selected this run.
        if (dateStr >= startDate && dateStr <= endDate && selectedShifts.includes(sid)) {
          const shiftRef = shifts.find((s: any) => s.id === sid);
          if (shiftRef) {
            const fullUser = users.find((u: any) => u.id === uid);
            assignments.push({
              date: dateStr,
              shiftId: sid,
              shift: shiftRef,
              assignedUsers: fullUser ? [fullUser] : [],
              availableUsers: [],
              unavailableUsers: [],
              isRotationAssignment: false,
              isFromDb: true,
            } as any);
          }
        }
      }
      for (const a of pastPiketts) {
        if (a.status === 'CANCELLED' || a.status === 'REFUSED') continue;
        const uid = a.userId;
        const pid = a.pikettId;
        if (!uid || !pid) continue;
        if (!userShiftsTracking[uid]) userShiftsTracking[uid] = {};
        userShiftsTracking[uid][pid] = (userShiftsTracking[uid][pid] || 0) + 1;
        if (!userCurrentRunTracking[uid]) userCurrentRunTracking[uid] = {};
        userCurrentRunTracking[uid][pid] = (userCurrentRunTracking[uid][pid] || 0) + 1;
        const dateStr = normalizeDbDateStr(a.date);
        dbAlreadyAssigned.add(`${dateStr}|${pid}`);
        // Seed pikett fast-lookup sets so both same-day (soft-block) and same-week
        // (avoid support shift) checks respect DB-loaded pikett assignments.
        if (dateStr >= startDate && dateStr <= endDate) {
          assignedPikettSet.add(`${dateStr}|${uid}`);
          assignedAnyShiftSet.add(`${dateStr}|${uid}`);
        }
        const wk = isoWeekOfDate(dateStr);
        pikettWeekMemberSet.add(`${wk}|${uid}`);
        pikettWeekMembersFromDb.add(`${wk}|${uid}`);
        // Count each (pikett, user, week) once even if DB has 7 day-rows.
        const seenKey = `${pid}|${uid}|${wk}`;
        if (!pikettWeekSeenFromDb.has(seenKey)) {
          pikettWeekSeenFromDb.add(seenKey);
          if (!pikettWeekCountFromDb.has(pid)) pikettWeekCountFromDb.set(pid, new Map());
          const pcMap = pikettWeekCountFromDb.get(pid)!;
          pcMap.set(uid, (pcMap.get(uid) || 0) + 1);
        }
        if (!lastPikettWeekIndexFromDb.has(pid)) lastPikettWeekIndexFromDb.set(pid, new Map());
        const lwMap = lastPikettWeekIndexFromDb.get(pid)!;
        const wkIdx = weekKeyToIdx(wk);
        if ((lwMap.get(uid) ?? -Infinity) < wkIdx) lwMap.set(uid, wkIdx);
        // Surface the DB row in the preview only for piketts selected this run.
        if (dateStr >= startDate && dateStr <= endDate && selectedPiketts.includes(pid)) {
          const pikettRef = piketts.find((p: any) => p.id === pid);
          if (pikettRef) {
            const fullUser = users.find((u: any) => u.id === uid);
            assignments.push({
              date: dateStr,
              shiftId: pid,
              shift: { ...pikettRef, startTime: '00:00', endTime: '23:59' },
              assignedUsers: fullUser ? [fullUser] : [],
              availableUsers: [],
              unavailableUsers: [],
              isRotationAssignment: false,
              isPikett: true,
              isFromDb: true,
            } as any);
          }
        }
      }
    } catch {
      // Non-blocking — fall back to per-run fairness only
    }

    // Same-week dedup counters for the current run
    const weeklyAssignments: { [weekKey: string]: { [shiftId: string]: Set<string> } } = {};

    // O(1) lookup maps
    const shiftMap = new Map(shifts.map((s: any) => [s.id, s]));
    const pikettMap = new Map(piketts.map((p: any) => [p.id, p]));
    const dateDowMap = new Map(dates.map(d => [d, new Date(d).getDay()]));
    // Working-day adjacency: Friday's next = Monday, Monday's prev = Friday
    // (weekends skipped when Sat/Sun aren't part of the shift's daysOfWeek).
    // Adjacent depends on the shift, so we compute on demand and memo per (date|shiftId).
    const adjCache = new Map<string, { prev?: string; next?: string }>();
    const getAdjacent = (date: string, shiftId?: string): { prev?: string; next?: string } => {
      const key = `${date}|${shiftId || '*'}`;
      if (adjCache.has(key)) return adjCache.get(key)!;
      const shift = shiftId ? shiftMap.get(shiftId) : null;
      const allowedDows: number[] | null = shift?.daysOfWeek || null;
      const isWorkDay = (d: Date) => !allowedDows || allowedDows.includes(d.getDay());
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const [y, m, dd] = date.split('-').map(Number);
      const base = new Date(y, (m || 1) - 1, dd || 1, 12);
      const walk = (dir: 1 | -1): string | undefined => {
        const d = new Date(base);
        for (let i = 0; i < 7; i++) {
          d.setDate(d.getDate() + dir);
          if (isWorkDay(d)) return fmt(d);
        }
        return undefined;
      };
      const result = { prev: walk(-1), next: walk(1) };
      adjCache.set(key, result);
      return result;
    };
    // Backwards-compat: the old map (calendar days only, no daysOfWeek filter)
    // is still used by the fairness "isAdjacentAssigned" check that spans all shifts.
    const dateAdjacentMap = new Map(dates.map((d, i) => {
      return [d, {
        prev: i > 0 ? dates[i - 1] : undefined,
        next: i < dates.length - 1 ? dates[i + 1] : undefined
      }];
    }));
    // Sets declared above (seeded from DB in the snapshot).
    // MAX_LOAD is annual: count ALL active days in the endDate's year for this
    // shift/pikett — regardless of the current planning range.
    const activeDateCountCache = new Map<string, number>();
    const getActiveDateCount = (itemId: string): number => {
      if (activeDateCountCache.has(itemId)) return activeDateCountCache.get(itemId)!;
      const item = shiftMap.get(itemId) || pikettMap.get(itemId);
      const [ey] = String(endDate).split('-').map(Number);
      const yearStart = new Date(ey, 0, 1);
      const yearEnd = new Date(ey, 11, 31);
      let count = 0;
      for (let d = new Date(yearStart); d.getTime() <= yearEnd.getTime(); d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        if (!item?.daysOfWeek || item.daysOfWeek.includes(dow)) count++;
      }
      activeDateCountCache.set(itemId, count);
      return count;
    };
    const getWeekKey = (dateStr: string) => {
      const d = new Date(dateStr);
      const tmp = new Date(d.valueOf());
      const dayNum = tmp.getUTCDay() || 7;
      tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      return `${tmp.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
    };

    // Seed availability for the days already elapsed this year, so the fairness
    // ratio has a denominator covering the same span as the assignment counts
    // seeded from the DB. Without this the ratio would be "a year of shifts over
    // one tranche of days", and anyone returning from leave would still be
    // picked first. Days spent out of office do not count as available.
    {
      const [ey] = String(endDate).split('-').map(Number);
      const yearStart = new Date(ey, 0, 1);
      const historyEnd = new Date(Math.min(new Date(startDate).getTime(), Date.now()));
      const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      // Past absences, so leave taken earlier this year lowers the denominator
      // too. Scoped to this block on purpose: it must never reach
      // outOfOfficeEvents, which drives the preview table — showing a year of
      // absences there would bury the ones that matter for the selected range.
      let pastOof: OutlookEvent[] = [];
      try {
        const resp = await authFetch(`/api/out-of-office?start=${fmt(yearStart)}&end=${fmt(historyEnd)}`);
        if (resp.ok) pastOof = await resp.json();
      } catch {
        // Non-blocking: the ratio stays slightly optimistic for absentees.
      }

      // Index absences per user once: isUserAvailable would otherwise rescan the
      // whole list for every user on every past day of the year.
      const oofByEmail = new Map<string, OutlookEvent[]>();
      for (const e of pastOof) {
        const addr = e.organizer?.emailAddress?.address?.toLowerCase();
        if (!addr) continue;
        const list = oofByEmail.get(addr) || [];
        list.push(e);
        oofByEmail.set(addr, list);
      }

      for (const shiftId of selectedShifts) {
        const shift = shiftMap.get(shiftId);
        if (!shift) continue;
        const eligible = getEligibleUsersForShift(shift);
        if (eligible.length === 0) continue;

        for (let d = new Date(yearStart); d.getTime() < historyEnd.getTime(); d.setDate(d.getDate() + 1)) {
          if (shift.daysOfWeek && !shift.daysOfWeek.includes(d.getDay())) continue;
          const dayStr = fmt(d);
          for (const u of eligible) {
            if (isUserOnHoliday(u.location || '', dayStr)) continue;
            // Part-timers have fewer working days, so their denominator must
            // shrink accordingly or they would look under-used.
            if (settings.respectWorkPercentage &&
                !isUserWorkingOnDay(u, dayStr, shift.startTime, shift.endTime)) continue;
            if (settings.checkCalendars) {
              const userOof = oofByEmail.get((u.email || '').toLowerCase());
              if (userOof && userOof.length > 0) {
                const av = isUserAvailable(u, dayStr, userOof, shift);
                if (!av.available && av.coversFullShift) continue;
              }
            }
            if (!userAvailableDays[u.id]) userAvailableDays[u.id] = {};
            userAvailableDays[u.id][shiftId] = (userAvailableDays[u.id][shiftId] || 0) + 1;
          }
        }
      }
    }

    // PART 1: Process selected PIKETTS
    if (selectedPiketts.length > 0) {
      
      for (const pikettId of selectedPiketts) {
        const pikett = pikettMap.get(pikettId);
        if (!pikett) continue;
        
        // Get eligible users for this pikett
        const eligibleUsers = [
          ...currentUsers.filter(u => 
            u.teamId === pikett.teamId && 
            u.status === 'ACTIVE' && 
            !(pikett.excludedUserIds || []).includes(u.id)
          ),
          ...currentUsers.filter(u => 
            (pikett.includedUserIds || []).includes(u.id) && 
            u.status === 'ACTIVE'
          )
        ];
        
        if (eligibleUsers.length === 0) {
          continue;
        }

        // Organize dates by ISO week
        const weekGroups = new Map<string, string[]>();
        
        for (const date of dates) {
          const dateObj = new Date(date);
          const tempDate = new Date(dateObj.valueOf());
          const dayNum = tempDate.getUTCDay() || 7;
          tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
          const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
          const weekNo = Math.ceil((((tempDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
          const weekKey = `${tempDate.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
          
          if (!weekGroups.has(weekKey)) {
            weekGroups.set(weekKey, []);
          }
          weekGroups.get(weekKey)!.push(date);
        }
        
        const sortedWeeks = Array.from(weekGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        const shuffledUsers = shuffleArray(eligibleUsers, randomSeed, `pikett-${pikettId}`);

        // Tracker to avoid consecutive assignments
        let lastAssignedUserId: string | null = null;

        // Fairness + rest-weeks tracking, seeded from DB history.
        const dbCountsForThisPikett = pikettWeekCountFromDb.get(pikettId) || new Map<string, number>();
        const dbLastForThisPikett = lastPikettWeekIndexFromDb.get(pikettId) || new Map<string, number>();
        const pikettWeekCount: Map<string, number> = new Map(
          shuffledUsers.map((u: any) => [u.id, dbCountsForThisPikett.get(u.id) || 0])
        );
        const lastPikettWeekIndex: Map<string, number> = new Map();
        for (const u of shuffledUsers) {
          const past = dbLastForThisPikett.get(u.id);
          if (past !== undefined) lastPikettWeekIndex.set(u.id, past);
        }
        const minRest = pikett.minRestWeeks ?? 3;

        // Weekly assignment loop (rotation + OOF verification).
        for (const [weekKeyIter, weekDates] of sortedWeeks) {
          const weekKey = weekKeyIter;
          const currentWeekIdx = weekKeyToIdx(weekKey);

          // Rank: fewest weeks first, then longest rest first.
          const rankedCandidates = [...shuffledUsers].sort((a: any, b: any) => {
            const ca = pikettWeekCount.get(a.id) ?? 0;
            const cb = pikettWeekCount.get(b.id) ?? 0;
            if (ca !== cb) return ca - cb;
            const la = lastPikettWeekIndex.get(a.id) ?? -Infinity;
            const lb = lastPikettWeekIndex.get(b.id) ?? -Infinity;
            return la - lb;
          });

          let assignedUserForWeek: any = null;
          let restRuleRelaxed = false;

          const tryPickUser = (allowRestRule: boolean): any => {
            for (const candidateUser of rankedCandidates) {
              // WEEK_PARITY rule
              const wpRules = (candidateUser.rules || []).filter(
                (r: any) => r.type === 'WEEK_PARITY' && r.enabled
              );
              if (wpRules.length > 0) {
                const weekNum = parseInt(weekKey.split('-W')[1]);
                const isOddWeek = weekNum % 2 !== 0;
                const wantsOdd = wpRules[0].config.parity === 'odd';
                if ((wantsOdd && !isOddWeek) || (!wantsOdd && isOddWeek)) continue;
              }

              if (lastAssignedUserId && candidateUser.id === lastAssignedUserId && rankedCandidates.length > 1) continue;

              // Two piketts same week allowed only if a DS rule links them.
              const alreadyOnAnotherPikettThisWeek =
                pikettWeekMemberSet.has(`${weekKey}|${candidateUser.id}`) ||
                pikettWeekMembersFromDb.has(`${weekKey}|${candidateUser.id}`);
              if (alreadyOnAnotherPikettThisWeek) {
                const dsRules = (candidateUser.rules || []).filter(
                  (r: any) => r.type === 'DOUBLE_SHIFT' && r.enabled
                );
                const otherPikettIds = assignments
                  .filter(a =>
                    a.isPikett && a.shiftId !== pikettId &&
                    isoWeekOfDate(a.date) === weekKey &&
                    a.assignedUsers.some((u: any) => u.id === candidateUser.id)
                  )
                  .map(a => a.shiftId);
                // DOUBLE_SHIFT is directional: only "already on trigger → may take
                // linked" is allowed. The reverse needs its own explicit rule.
                const hasLinkingRule = dsRules.some((r: any) =>
                  otherPikettIds.includes(r.config.triggerShiftId) && r.config.linkedShiftId === pikettId
                );
                if (!hasLinkingRule) continue;
              }

              // Rest-weeks law — checks THIS pikett + every other pikett (current run + DB history).
              if (allowRestRule) {
                let mostRecentIdx: number | undefined;
                const localIdx = lastPikettWeekIndex.get(candidateUser.id);
                if (localIdx !== undefined) mostRecentIdx = localIdx;
                for (const otherPid of selectedPiketts) {
                  if (otherPid === pikettId) continue;
                  for (const a of assignments) {
                    if (!a.isPikett || a.shiftId !== otherPid) continue;
                    if (!a.assignedUsers.some((u: any) => u.id === candidateUser.id)) continue;
                    const wIdx = weekKeyToIdx(isoWeekOfDate(a.date));
                    if (mostRecentIdx === undefined || wIdx > mostRecentIdx) mostRecentIdx = wIdx;
                  }
                  const dbMap = lastPikettWeekIndexFromDb.get(otherPid);
                  const dbIdx = dbMap?.get(candidateUser.id);
                  if (dbIdx !== undefined && (mostRecentIdx === undefined || dbIdx > mostRecentIdx)) {
                    mostRecentIdx = dbIdx;
                  }
                }
                if (mostRecentIdx !== undefined && currentWeekIdx - mostRecentIdx <= minRest) continue;
              }

              // MAX_LOAD rule for this pikett (annual cap, DB + current run).
              const pikettMaxLoadRules = (candidateUser.rules || []).filter(
                (r: any) => r.type === 'MAX_LOAD' && r.enabled && r.config.shiftId === pikettId
              );
              if (pikettMaxLoadRules.length > 0) {
                const pct = pikettMaxLoadRules[0].config.maxPercentage;
                const activeDates = getActiveDateCount(pikettId);
                const maxAssignments = Math.max(1, Math.ceil(activeDates * (pct / 100)));
                const current = userCurrentRunTracking[candidateUser.id]?.[pikettId] || 0;
                if (current >= maxAssignments) continue;
              }

              // OOF check (piketts ignore public holidays — 24/7 duty).
              if (settings.checkCalendars) {
                let unavailableDaysCount = 0;
                for (const date of weekDates) {
                  const availability = isUserAvailable(candidateUser, date, oofEvents, undefined, true);
                  if (!availability.available && availability.coversFullShift) unavailableDaysCount++;
                }
                if (unavailableDaysCount > 2) continue;
              }
              return candidateUser;
            }
            return null;
          };

          assignedUserForWeek = tryPickUser(true);
          if (!assignedUserForWeek) {
            // Fallback: relax the rest-weeks rule (still logged as an exception).
            assignedUserForWeek = tryPickUser(false);
            restRuleRelaxed = !!assignedUserForWeek;
          }

          if (assignedUserForWeek) {
            pikettWeekCount.set(assignedUserForWeek.id, (pikettWeekCount.get(assignedUserForWeek.id) ?? 0) + 1);
            lastPikettWeekIndex.set(assignedUserForWeek.id, currentWeekIdx);
            lastAssignedUserId = assignedUserForWeek.id;
            // MAX_LOAD counts one entry per covered day (mirrors the DB rows).
            if (!userCurrentRunTracking[assignedUserForWeek.id]) userCurrentRunTracking[assignedUserForWeek.id] = {};
            userCurrentRunTracking[assignedUserForWeek.id][pikettId] =
              (userCurrentRunTracking[assignedUserForWeek.id][pikettId] || 0) + weekDates.length;
            if (restRuleRelaxed) {
              // eslint-disable-next-line no-console
              console.warn(`[pikett] ${pikett.name} ${weekKey}: rest rule (${minRest} weeks) relaxed for ${assignedUserForWeek.firstName} ${assignedUserForWeek.lastName}`);
            }
            // Block this user from support shifts during the pikett week.
            if (pikett.avoidSupportSameWeek !== false) {
              for (const d of weekDates) {
                pikettWeekMemberSet.add(`${weekKey}|${assignedUserForWeek.id}`);
                assignedAnyShiftSet.add(`${d}|${assignedUserForWeek.id}`);
              }
            }
          }

          // Create one assignment per day (piketts always cover the full week).
            for (const date of weekDates) {
              if (dbAlreadyAssigned.has(`${date}|${pikettId}`)) continue;
            if (!assignedUserForWeek) {
              assignments.push({
                date,
                shiftId: pikettId,
                shift: {
                  ...pikett,
                  name: `${pikett.name}`,
                  startTime: '00:00',
                  endTime: '23:59'
                },
                assignedUsers: [],
                availableUsers: [],
                unavailableUsers: eligibleUsers.map(u => ({
                  user: u,
                  reason: t('reasonNoUserAvailable'),
                  conflictEvents: []
                })),
                isPikett: true,
                isRotationAssignment: false,
              });
            } else {
              // Check availability for this specific day
              let dayAvailable = true;
              let dayConflicts: OutlookEvent[] = [];
              let unavailabilityReason = '';

              // Piketts stay on duty on public holidays — check Outlook only.
              if (dayAvailable && settings.checkCalendars) {
                const availability = isUserAvailable(assignedUserForWeek, date, oofEvents, undefined, true);
                dayAvailable = availability.available;
                if (!dayAvailable) {
                  dayConflicts = availability.conflictEvents;
                  unavailabilityReason = t('reasonOutOfOffice');
                }
              }

              // If the primary user is OOF/on holiday for this specific day,
              // try to find a same-week fallback user so the day isn't left empty.
              // Split-week fallback: try another eligible user for this day only.
              let effectiveUser: any = dayAvailable ? assignedUserForWeek : null;
              let effectiveConflicts: OutlookEvent[] = dayConflicts;
              let effectiveReason = unavailabilityReason;
              if (!dayAvailable) {
                const weekKeyForDay = isoWeekOfDate(date);
                for (const alt of shuffledUsers) {
                  if (alt.id === assignedUserForWeek.id) continue;
                  if (isUserOnHoliday(alt.location || '', date)) continue;
                  // Skip users already on another pikett this week.
                  if (pikettWeekMemberSet.has(`${weekKeyForDay}|${alt.id}`) ||
                      pikettWeekMembersFromDb.has(`${weekKeyForDay}|${alt.id}`)) continue;
                  if (settings.checkCalendars) {
                    const altAvailability = isUserAvailable(alt, date, oofEvents, undefined, true);
                    if (!altAvailability.available) continue;
                  }
                  effectiveUser = alt;
                  effectiveConflicts = [];
                  effectiveReason = '';
                  break;
                }
              }

              // Track for support-shift block + cross-pikett fairness.
              if (effectiveUser) {
                assignedPikettSet.add(`${date}|${effectiveUser.id}`);
                assignedAnyShiftSet.add(`${date}|${effectiveUser.id}`);
                if (pikett.avoidSupportSameWeek !== false) {
                  pikettWeekMemberSet.add(`${weekKey}|${effectiveUser.id}`);
                }
              }

              assignments.push({
                date,
                shiftId: pikettId,
                shift: {
                  ...pikett,
                  name: `${pikett.name}`,
                  startTime: '00:00',
                  endTime: '23:59'
                },
                assignedUsers: effectiveUser ? [effectiveUser] : [],
                // Manual UI can pick any eligible user (split-week friendly).
                availableUsers: shuffledUsers.filter(u => u.id !== effectiveUser?.id),
                unavailableUsers: !effectiveUser
                  ? [{
                      user: assignedUserForWeek,
                      reason: effectiveReason || t('reasonNotAvailable'),
                      conflictEvents: effectiveConflicts
                    }]
                  : [],
                isPikett: true,
                isRotationAssignment: false,
              });
            }
          }

        }
        
      }
    }
    
   // PART 2 — Regular (non-pikett) shifts.
    if (selectedShifts.length > 0) {
      const rotationUsers = currentUsers.filter(u => u.rotationConfig?.patternId);

      let shiftsToProcess = [...selectedShifts];
      if (settings.prioritySystem) {
        shiftsToProcess.sort((a, b) => {
          const shiftA = shiftMap.get(a);
          const shiftB = shiftMap.get(b);
          const membersA = getEligibleUsersForShift(shiftA).length;
          const membersB = getEligibleUsersForShift(shiftB).length;
          return membersA - membersB;
        });
      }

      // PART 2.1 — Process rotations first so assignedNormalShiftSet is fully
      // populated before regular assignment (consecutive-shift checks depend on it).
      if (settings.enableRotations) {
        for (const date of dates) {
          for (const rotationUser of rotationUsers) {
            const shiftId = getRotationShiftForUserOnDate(
              rotationUser.id,
              date,
              rotationUser
            );

            if (!shiftId) continue;

            const isSelectedShift = selectedShifts.includes(shiftId);
            const isSelectedPikett = selectedPiketts.includes(shiftId);
            if (!isSelectedShift && !isSelectedPikett) continue;

            const rotSelectedShift = isSelectedShift ? shiftMap.get(shiftId) || null : null;
            const rotSelectedPikett = isSelectedPikett ? pikettMap.get(shiftId) || null : null;
            const selectedItem = rotSelectedShift || (rotSelectedPikett ? {
              ...rotSelectedPikett,
              startTime: '00:00',
              endTime: '23:59'
            } : null);
            if (!selectedItem) continue;

            // Skip if PART 1 already placed a pikett here.
            const alreadyHasAssignment = assignments.some(a =>
              a.date === date && a.shiftId === shiftId
            );
            if (alreadyHasAssignment) continue;

            if (isUserOnHoliday(rotationUser.location || '', date)) continue;

            if (settings.respectWorkPercentage) {
              const worksThisDay = isUserWorkingOnDay(rotationUser, date, selectedItem.startTime, selectedItem.endTime);
              if (!worksThisDay) continue;
            }

            if (settings.checkCalendars) {
              const availability = isUserAvailable(rotationUser, date, oofEvents, selectedItem);
              if (!availability.available && availability.coversFullShift) continue;
            }

            // Check WEEK_PARITY rule
            const rotWpRules = (rotationUser.rules || []).filter(
              (r: any) => r.type === 'WEEK_PARITY' && r.enabled
            );
            if (rotWpRules.length > 0) {
              const wk = getWeekKey(date);
              const weekNum = parseInt(wk.split('-W')[1]);
              const isOddWeek = weekNum % 2 !== 0;
              const wantsOdd = rotWpRules[0].config.parity === 'odd';
              if ((wantsOdd && !isOddWeek) || (!wantsOdd && isOddWeek)) continue;
            }

            // Block adjacent-day repeats only for shifts with minConsecutiveDays=1.
            // "Adjacent" = previous / next WORKING day of the shift (Friday↔Monday).
            if ((selectedItem.minConsecutiveDays || 1) <= 1 && !rotSelectedPikett) {
              const adjacent = getAdjacent(date, shiftId);
              const hasConsecutiveForThisShift = (
                (adjacent.prev ? assignments.some(a => a.date === adjacent.prev && a.shiftId === shiftId && a.assignedUsers.some((u: any) => u.id === rotationUser.id)) : false) ||
                (adjacent.next ? assignments.some(a => a.date === adjacent.next && a.shiftId === shiftId && a.assignedUsers.some((u: any) => u.id === rotationUser.id)) : false)
              );
              if (hasConsecutiveForThisShift) continue;
            }

            const eligibleUsers = getEligibleUsersForShift(selectedItem);
            if (!eligibleUsers.some(u => u.id === rotationUser.id)) continue;

            // Bump fairness + current-run counters.
            if (!userShiftsTracking[rotationUser.id]) userShiftsTracking[rotationUser.id] = {};
            if (!userShiftsTracking[rotationUser.id][shiftId]) userShiftsTracking[rotationUser.id][shiftId] = 0;
            if (!userCurrentRunTracking[rotationUser.id]) userCurrentRunTracking[rotationUser.id] = {};
            if (!userCurrentRunTracking[rotationUser.id][shiftId]) userCurrentRunTracking[rotationUser.id][shiftId] = 0;
            userCurrentRunTracking[rotationUser.id][shiftId]++;
            userShiftsTracking[rotationUser.id][shiftId]++;

            if (!rotSelectedPikett) {
              assignedNormalShiftSet.add(`${date}|${rotationUser.id}`);
            }
            assignedAnyShiftSet.add(`${date}|${rotationUser.id}`);

            assignments.push({
              date,
              shiftId: selectedItem.id,
              shift: selectedItem,
              assignedUsers: [{
                ...rotationUser,
                shiftsAssigned: { ...userShiftsTracking[rotationUser.id] }
              }],
              availableUsers: [],
              unavailableUsers: eligibleUsers
                .filter(u => u.id !== rotationUser.id)
                .map(u => ({
                  user: u,
                  reason: t('reasonReservedRotation'),
                  conflictEvents: []
                })),
              isRotationAssignment: true,
              isPikett: !!rotSelectedPikett,
            });
          }
        }
      }

      // Weekly re-shuffle queues per shift
      const shiftWeekQueues: { [key: string]: any[] } = {};
      const shiftWeekPointers: { [key: string]: number } = {};
      const shiftConsecutiveTracker: { [shiftId: string]: { userId: string; count: number } } = {};

      // PART 2.2 — Assign non-rotation shifts, day by day, in priority order
      // (shifts with fewest eligible users first).
      for (let dateIdx = 0; dateIdx < dates.length; dateIdx++) {
        const date = dates[dateIdx];
        const dailyAssignments: { [userId: string]: string[] } = {};

        for (const shiftId of shiftsToProcess) {
          const shift = shiftMap.get(shiftId);
          if (!shift) continue;

          const dayOfWeek = dateDowMap.get(date)!;
          if (shift.daysOfWeek && !shift.daysOfWeek.includes(dayOfWeek)) continue;

          const alreadyAssigned = assignments.some(a =>
            a.date === date && a.shiftId === shiftId && a.isRotationAssignment
          );
          if (alreadyAssigned) continue;
          if (dbAlreadyAssigned.has(`${date}|${shiftId}`)) continue;

          const eligibleUsers = getEligibleUsersForShift(shift);
          const availableForThisDate: any[] = [];
          const unavailableUsers: Array<{user: any; reason: string; conflictEvents: OutlookEvent[]}> = [];

          for (const user of getInactiveUsersForShift(shift)) {
            unavailableUsers.push({ user, reason: t('reasonInactive'), conflictEvents: [] });
          }

          for (const user of eligibleUsers) {
          // Priority 1 — Public holidays
          if (isUserOnHoliday(user.location || '', date)) {
            const holidayForDate = holidays.find(holiday => {
              const holidayDate = new Date(holiday.date).toISOString().split('T')[0];
              return holidayDate === date;
            });

            unavailableUsers.push({
              user,
              reason: holidayForDate ? t('reasonHolidayWithName', { name: holidayForDate.name }) : t('reasonHoliday'),
              conflictEvents: [{
                id: 'holiday',
                subject: holidayForDate?.name || t('reasonHoliday'),
                start: { dateTime: new Date(date + 'T00:00:00').toISOString() },
                end: { dateTime: new Date(date + 'T23:59:59').toISOString() },
                showAs: 'oof' as const,
                isAllDay: true
              }]
            });
            continue;
          }

          // Priority 2 — Work availability
          const worksThisDay = isUserWorkingOnDay(user, date, shift?.startTime, shift?.endTime);
          if (!worksThisDay) {
            const isJoker = (user.workPercent ?? 100) === 0;
            unavailableUsers.push({
              user,
              reason: isJoker ? t('joker') : t('reasonNotWorkingToday'),
              conflictEvents: []
            });
            continue;
          }

          // Priority 2.5 — WEEK_PARITY rule
          const weekParityRules = (user.rules || []).filter(
            (r: any) => r.type === 'WEEK_PARITY' && r.enabled
          );
          if (weekParityRules.length > 0) {
            const wk = getWeekKey(date);
            const weekNum = parseInt(wk.split('-W')[1]);
            const isOddWeek = weekNum % 2 !== 0;
            const wantsOdd = weekParityRules[0].config.parity === 'odd';
            if ((wantsOdd && !isOddWeek) || (!wantsOdd && isOddWeek)) {
              unavailableUsers.push({
                user,
                reason: t('reasonWeekParity', { parity: wantsOdd ? 'odd' : 'even' }),
                conflictEvents: []
              });
              continue;
            }
          }

          // Priority 2.7 — Block support shift if user is on a pikett this week
          // (current run + DB history from a previous run).
          const currentWk = getWeekKey(date);
          if (pikettWeekMemberSet.has(`${currentWk}|${user.id}`) ||
              pikettWeekMembersFromDb.has(`${currentWk}|${user.id}`)) {
            unavailableUsers.push({
              user,
              reason: t('reasonPikettSameWeek'),
              conflictEvents: []
            });
            continue;
          }

          // Priority 3 — Already on another shift today
          const hasNormalShiftToday = assignedNormalShiftSet.has(`${date}|${user.id}`);
          if (hasNormalShiftToday) {
            const otherAssignment = assignments.find(a =>
              a.date === date && a.shiftId !== shiftId && a.assignedUsers.some((u: any) => u.id === user.id)
            );
            const otherShiftName = otherAssignment?.shift?.name || shiftMap.get(otherAssignment?.shiftId || '')?.name;
            unavailableUsers.push({
              user,
              reason: otherShiftName
                ? t('reasonAlreadyAssignedToShift', { shift: otherShiftName })
                : t('reasonAlreadyAssignedToday'),
              conflictEvents: []
            });
            continue;
          }

          // Priority 4 — Outlook calendar (only OOF covering ≥50% of the shift blocks)
          if (settings.checkCalendars) {
            const availability = isUserAvailable(user, date, oofEvents, shift);
            if (!availability.available && availability.coversFullShift) {
              unavailableUsers.push({
                user,
                reason: t('reasonOutOfOffice'),
                conflictEvents: availability.conflictEvents
              });
              continue;
            }
          }

          // Priority 5 — Consecutive shifts (minConsecutiveDays=1 → avoid same user on adjacent working days).
          if ((shift.minConsecutiveDays || 1) <= 1) {
            const adjacent = getAdjacent(date, shiftId);
            const hasConsecutiveForThisShift = (
              (adjacent.prev ? assignments.some(a => a.date === adjacent.prev && a.shiftId === shiftId && a.assignedUsers.some((u: any) => u.id === user.id)) : false) ||
              (adjacent.next ? assignments.some(a => a.date === adjacent.next && a.shiftId === shiftId && a.assignedUsers.some((u: any) => u.id === user.id)) : false)
            );

            if (hasConsecutiveForThisShift) {
              unavailableUsers.push({
                user,
                reason: t('reasonConsecutiveShifts'),
                conflictEvents: []
              });
              continue;
            }
          }
            
          // Priority 6 — MAX_LOAD rule (current run only; DB history is a different period).
          const maxLoadRules = (user.rules || []).filter(
            (r: any) => r.type === 'MAX_LOAD' && r.enabled && r.config.shiftId === shiftId
          );
          if (maxLoadRules.length > 0) {
            const maxRule = maxLoadRules[0];
            const activeDatesForShift = getActiveDateCount(shiftId);
            const pct = maxRule.config.maxPercentage;
            const maxAssignments = Math.max(1, Math.ceil(activeDatesForShift * (pct / 100)));
            const current = userCurrentRunTracking[user.id]?.[shiftId] || 0;
            if (current >= maxAssignments) {
              unavailableUsers.push({
                user,
                reason: t('reasonMaxLoad', { pct: maxRule.config.maxPercentage }),
                conflictEvents: []
              });
              continue;
            }
          }

          // User passed every priority check → available.
          availableForThisDate.push(user);

          if (!userAvailableDays[user.id]) {
            userAvailableDays[user.id] = {};
          }
          if (!userAvailableDays[user.id][shiftId]) {
            userAvailableDays[user.id][shiftId] = 0;
          }
          userAvailableDays[user.id][shiftId]++;
          }

          let assignedUsers: any[] = [];
          let noAssignmentReason: string | undefined = undefined;

          if (availableForThisDate.length > 0) {
            const weekKey = getWeekKey(date);
            const weekShiftKey = `${weekKey}-${shiftId}`;

            // Re-shuffle per week+shift so weekdays rotate across weeks
            if (!shiftWeekQueues[weekShiftKey]) {
              const weekIndex = Object.keys(shiftWeekQueues).filter(k => k.endsWith(`-${shiftId}`)).length;
              shiftWeekQueues[weekShiftKey] = shuffleArray(
                getEligibleUsersForShift(shift),
                randomSeed,
                `${shiftId}-week${weekIndex}`
              );
              shiftWeekPointers[weekShiftKey] = 0;
            }

            const queue = shiftWeekQueues[weekShiftKey];
            // Users already used this week (current run + DB history) — do not repick.
            const weekSet = new Set<string>([
              ...(weeklyAssignments[weekKey]?.[shiftId] || []),
              ...(weeklyAssignmentsFromDb[weekKey]?.[shiftId] || []),
            ]);
            // Prefer non-pikett users; pikett users are fallback.
            const nonPikettAvailable = availableForThisDate.filter(u => !assignedPikettSet.has(`${date}|${u.id}`));
            const pikettOnlyAvailable = availableForThisDate.filter(u => assignedPikettSet.has(`${date}|${u.id}`));

            let selectedUser: any = null;
            const minConsec = shift.minConsecutiveDays || 1;

            // Pass 0 — Keep the same user while below minConsecutiveDays; above, only if their ratio stays reasonable.
            if (minConsec > 1) {
              const tracker = shiftConsecutiveTracker[shiftId];
              if (tracker) {
                const prevUser = availableForThisDate.find(u => u.id === tracker.userId);
                if (prevUser) {
                  if (tracker.count < minConsec) {
                    selectedUser = prevUser;
                  } else {
                    const userRatio = (userShiftsTracking[prevUser.id]?.[shiftId] || 0) / (userAvailableDays[prevUser.id]?.[shiftId] || 1);
                    const othersAvg = availableForThisDate
                      .filter(u => u.id !== prevUser.id)
                      .reduce((sum, u) => sum + (userShiftsTracking[u.id]?.[shiftId] || 0) / (userAvailableDays[u.id]?.[shiftId] || 1), 0)
                      / Math.max(1, availableForThisDate.length - 1);
                    if (userRatio <= othersAvg * 1.2) selectedUser = prevUser;
                  }
                }
              }
            }

            const isAdjacentAssigned = (userId: string): boolean => {
              const adj = dateAdjacentMap.get(date);
              const prevAssigned = adj?.prev ? assignedNormalShiftSet.has(`${adj.prev}|${userId}`) : false;
              const nextAssigned = adj?.next ? assignedNormalShiftSet.has(`${adj.next}|${userId}`) : false;
              return prevAssigned || nextAssigned;
            };
            const totalAssignmentsFor = (userId: string): number =>
              Object.values(userShiftsTracking[userId] || {}).reduce((s: number, v: any) => s + (v as number), 0);
            // Load relative to the days the user was actually assignable. Comparing
            // raw totals punishes anyone back from leave: their count is low simply
            // because they were away, so they would absorb every shift until they
            // caught up. Holidays must not create a backlog.
            const totalAvailableDaysFor = (userId: string): number =>
              Object.values(userAvailableDays[userId] || {}).reduce((s: number, v: any) => s + (v as number), 0);
            const globalLoadFor = (userId: string): number => {
              const days = totalAvailableDaysFor(userId);
              // No observed availability yet: stay neutral instead of looking idle.
              if (days === 0) return Number.POSITIVE_INFINITY;
              return totalAssignmentsFor(userId) / days;
            };
            const shiftRatioFor = (userId: string): number =>
              (userShiftsTracking[userId]?.[shiftId] || 0) / (userAvailableDays[userId]?.[shiftId] || 1);
            // "How many of the last 4 weeks did this user already do this shift
            // on this same day-of-week?" — used to spread same-day repeats.
            const currentWkIdx = weekKeyToIdx(weekKey);
            const currentDow = dateDowMap.get(date)!;
            const sameDowRecentCount = (userId: string): number => {
              const list = shiftDowHistory.get(`${shiftId}|${userId}|${currentDow}`) || [];
              return list.filter(w => currentWkIdx - w <= 4 && currentWkIdx - w >= 0).length;
            };

            // Sort order: (1) not adjacent, (2) not used this week,
            // (3) FEWER same-shift-same-dow in last 4 weeks (spreads Fridays etc.),
            // (4) lower overall load ratio, (5) lower per-shift ratio, (6) shuffle queue.
            const sortCandidates = (arr: any[]): any[] => arr.slice().sort((a, b) => {
              const aAdj = isAdjacentAssigned(a.id) ? 1 : 0;
              const bAdj = isAdjacentAssigned(b.id) ? 1 : 0;
              if (aAdj !== bAdj) return aAdj - bAdj;
              const aWeek = weekSet.has(a.id) ? 1 : 0;
              const bWeek = weekSet.has(b.id) ? 1 : 0;
              if (aWeek !== bWeek) return aWeek - bWeek;
              const aDow = sameDowRecentCount(a.id);
              const bDow = sameDowRecentCount(b.id);
              if (aDow !== bDow) return aDow - bDow;
              if (settings.balanceShifts) {
                const aLoad = globalLoadFor(a.id);
                const bLoad = globalLoadFor(b.id);
                // Small tolerance so near-equal ratios fall through to the
                // per-shift ratio instead of being split by rounding noise.
                if (Math.abs(aLoad - bLoad) > 0.001) return aLoad - bLoad;
                const aRatio = shiftRatioFor(a.id);
                const bRatio = shiftRatioFor(b.id);
                if (aRatio !== bRatio) return aRatio - bRatio;
              }
              const aQueueIdx = queue.findIndex(u => u.id === a.id);
              const bQueueIdx = queue.findIndex(u => u.id === b.id);
              return aQueueIdx - bQueueIdx;
            });

            // Pass 1 — prefer non-pikett users, best candidate first
            if (!selectedUser && nonPikettAvailable.length > 0) {
              const sorted = sortCandidates(nonPikettAvailable);
              selectedUser = sorted[0];
              const idxInQueue = queue.findIndex(u => u.id === selectedUser.id);
              if (idxInQueue >= 0) {
                shiftWeekPointers[weekShiftKey] = (idxInQueue + 1) % queue.length;
              }
            }

            // Pass 2 — fallback to pikett users if non-pikett pool is empty
            if (!selectedUser && pikettOnlyAvailable.length > 0) {
              selectedUser = sortCandidates(pikettOnlyAvailable)[0];
            }

            // Pass 3: absolute fallback (should not happen)
            if (!selectedUser) {
              selectedUser = availableForThisDate[0];
            }

            // Track weekly assignment
            if (!weeklyAssignments[weekKey]) weeklyAssignments[weekKey] = {};
            if (!weeklyAssignments[weekKey][shiftId]) weeklyAssignments[weekKey][shiftId] = new Set();
            weeklyAssignments[weekKey][shiftId].add(selectedUser.id);

            if (!userShiftsTracking[selectedUser.id]) userShiftsTracking[selectedUser.id] = {};
            if (!userShiftsTracking[selectedUser.id][shiftId]) userShiftsTracking[selectedUser.id][shiftId] = 0;
            userShiftsTracking[selectedUser.id][shiftId]++;
            // Current-run counter for MAX_LOAD
            if (!userCurrentRunTracking[selectedUser.id]) userCurrentRunTracking[selectedUser.id] = {};
            if (!userCurrentRunTracking[selectedUser.id][shiftId]) userCurrentRunTracking[selectedUser.id][shiftId] = 0;
            userCurrentRunTracking[selectedUser.id][shiftId]++;
            // Same-day-of-week history for the anti-repeat sort key.
            {
              const dowKey = `${shiftId}|${selectedUser.id}|${dateDowMap.get(date)}`;
              const list = shiftDowHistory.get(dowKey) || [];
              list.push(weekKeyToIdx(weekKey));
              shiftDowHistory.set(dowKey, list);
            }

            // Pre-count DOUBLE_SHIFT linked shifts for fair distribution
            const dsRulesForSelected = (selectedUser.rules || []).filter(
              (r: any) => r.type === 'DOUBLE_SHIFT' && r.enabled && r.config.triggerShiftId === shiftId
            );
            for (const dsRule of dsRulesForSelected) {
              const lsId = dsRule.config.linkedShiftId;
              if (selectedShifts.includes(lsId) || selectedPiketts.includes(lsId)) {
                if (!userShiftsTracking[selectedUser.id][lsId]) userShiftsTracking[selectedUser.id][lsId] = 0;
                userShiftsTracking[selectedUser.id][lsId]++;
                if (!userCurrentRunTracking[selectedUser.id][lsId]) userCurrentRunTracking[selectedUser.id][lsId] = 0;
                userCurrentRunTracking[selectedUser.id][lsId]++;
              }
            }

            dailyAssignments[selectedUser.id] = [shift.name];
            selectedUser.shiftsAssigned = { ...userShiftsTracking[selectedUser.id] };
            assignedUsers = [selectedUser];

            // Update fast-lookup sets
            assignedNormalShiftSet.add(`${date}|${selectedUser.id}`);
            assignedAnyShiftSet.add(`${date}|${selectedUser.id}`);

            // Update consecutive tracker
            if (minConsec > 1) {
              const tracker = shiftConsecutiveTracker[shiftId];
              if (tracker && tracker.userId === selectedUser.id) {
                tracker.count++;
              } else {
                shiftConsecutiveTracker[shiftId] = { userId: selectedUser.id, count: 1 };
              }
            }
            
          } else {
            // Determine the main reason
            const holidayCount = unavailableUsers.filter(u => u.reason.includes(t('reasonHoliday'))).length;
            const oofCount = unavailableUsers.filter(u => u.reason === t('reasonOutOfOffice')).length;
            const workDayCount = unavailableUsers.filter(u => u.reason === t('reasonNotWorkingToday')).length;
            const consecutiveCount = unavailableUsers.filter(u => u.reason === t('reasonConsecutiveShifts')).length;
            const alreadyAssignedCount = unavailableUsers.filter(u => u.reason === t('reasonAlreadyAssignedToday')).length;

            if (holidayCount > 0 && holidayCount >= unavailableUsers.length * 0.5) {
              // Find the holiday name for this date
              const holidayForDate = holidays.find(holiday => {
                const holidayDate = new Date(holiday.date).toISOString().split('T')[0];
                return holidayDate === date;
              });

              noAssignmentReason = holidayForDate
                ? t('reasonHolidayWithName', { name: holidayForDate.name })
                : t('reasonHolidayForMost');
            } else if (workDayCount > 0 && workDayCount >= unavailableUsers.length * 0.5) {
              noAssignmentReason = t('reasonNonWorkDayForMost');
            } else if (oofCount > 0) {
              noAssignmentReason = t('reasonUsersOnLeave', { count: oofCount });
            } else if (alreadyAssignedCount > 0) {
              noAssignmentReason = t('reasonUsersAlreadyAssigned', { count: alreadyAssignedCount });
            } else if (consecutiveCount > 0) {
              noAssignmentReason = t('consecutiveShiftsConflict');
            } else {
              noAssignmentReason = t('noUsersAvailable');
            }
          }

          assignments.push({
            date,
            shiftId: shift.id,
            shift,
            assignedUsers,
            availableUsers: availableForThisDate,
            unavailableUsers,
            isRotationAssignment: false,
            noAssignmentReason
          });
        }
      }
    }
    
    // DOUBLE_SHIFT post-processing — supports chains (SEC→CDC, CDC→SEC).
    // Full-year lookback (Jan 1 → Dec 31) so any trigger already in DB fires,
    // even if it was sent months ago. DS never assigns past dates (the tryPickUser
    // path filters dates < today).
    let freshDbAssignments: any[] = [];
    try {
      const [ey] = String(endDate).split('-').map(Number);
      const dsLookbackStr = `${ey}-01-01`;
      const dsLookforwardStr = `${ey}-12-31`;
      const [shiftResp, pikettResp] = await Promise.all([
        authFetch(`/api/shift-assignments?startDate=${dsLookbackStr}&endDate=${dsLookforwardStr}`),
        authFetch(`/api/pikett-assignments?startDate=${dsLookbackStr}&endDate=${dsLookforwardStr}`),
      ]);
      const shiftRows: any[] = shiftResp.ok ? await shiftResp.json() : [];
      const pikettRows: any[] = pikettResp.ok ? await pikettResp.json() : [];
      // Normalize pikett rows into shift-shape so DS can trigger on either.
      freshDbAssignments = [
        ...shiftRows,
        ...pikettRows.map((p: any) => ({ ...p, shiftId: p.pikettId, isPikett: true })),
      ];
      if (shiftResp.ok) setDbAssignments(shiftRows);
    } catch {
      freshDbAssignments = dbAssignments;
    }

    // DB rows → DS triggers. Skip past dates (before startDate) to avoid past-dated assignments.
    const dbTriggerAssignments = freshDbAssignments
      .filter(dbA => dbA.status !== 'CANCELLED' && dbA.status !== 'REFUSED')
      .map(dbA => {
        const fullUser = users.find(u => u.id === dbA.userId);
        return {
          date: normalizeDbDate(dbA.date),
          shiftId: dbA.shiftId,
          shift: dbA.shift || dbA.pikett || null,
          assignedUsers: fullUser ? [fullUser] : [],
          isFromDb: true,
          isPikett: !!dbA.isPikett,
          isDoubleShiftTrigger: false as boolean | undefined,
        };
      })
      .filter(dbA => dbA.assignedUsers.length > 0 && dbA.date >= startDate && dbA.date <= endDate && !assignments.some(a => a.date === dbA.date && a.shiftId === dbA.shiftId));

    // 5-pass loop supports rule chains without infinite recursion.
    const allDoubleShiftAdditions: any[] = [];
    const dsAssignedSet = new Set<string>();
    const dsUserShiftCounts = new Map<string, number>();
    let dsSourceAssignments = [...assignments, ...dbTriggerAssignments];
    for (let dsPass = 0; dsPass < 5; dsPass++) {
      const passAdditions: any[] = [];
      for (const assignment of dsSourceAssignments) {
        for (const assignedUser of assignment.assignedUsers) {
          const dsRules = (assignedUser.rules || []).filter(
            (r: any) => r.type === 'DOUBLE_SHIFT' && r.enabled && r.config.triggerShiftId === assignment.shiftId
          );
          if (dsRules.length === 0) continue;
          for (const rule of dsRules) {
            const linkedShiftId = rule.config.linkedShiftId;
            const linkedIsSelected = selectedShifts.includes(linkedShiftId) || selectedPiketts.includes(linkedShiftId);
            if (!linkedIsSelected) continue;
            const linkedShift = shiftMap.get(linkedShiftId) || null;
            const linkedPikett = !linkedShift ? (pikettMap.get(linkedShiftId) || null) : null;
            const linkedItem = linkedShift || (linkedPikett ? { ...linkedPikett, startTime: '00:00', endTime: '23:59' } : null);
            if (!linkedItem) continue;

            const dsKey = `${assignment.date}|${linkedShiftId}|${assignedUser.id}`;
            if (dsAssignedSet.has(dsKey)) continue;

            const alreadyInAssignments = assignments.some(
              a => a.date === assignment.date && a.shiftId === linkedShiftId &&
                   a.assignedUsers.some((u: any) => u.id === assignedUser.id)
            );
            if (alreadyInAssignments) continue;

            if (settings.respectWorkPercentage && linkedShift) {
              const worksThisDay = isUserWorkingOnDay(assignedUser, assignment.date, linkedItem.startTime, linkedItem.endTime);
              if (!worksThisDay) continue;
            }
            if (isUserOnHoliday(assignedUser.location || '', assignment.date)) continue;
            if (settings.checkCalendars) {
              const availability = isUserAvailable(assignedUser, assignment.date, oofEvents, linkedItem);
              if (!availability.available && availability.coversFullShift) continue;
            }
            if (dsAssignedSet.has(`${assignment.date}|${linkedShiftId}|*`)) continue;
            // Rotations always win over dynamic DS.
            const rotationConflict = assignments.some(a =>
              a.date === assignment.date && a.shiftId === linkedShiftId && a.isRotationAssignment
            );
            if (rotationConflict) continue;
            // DS replaces any existing non-rotation assignment on this slot; rollback counters.
            for (let i = assignments.length - 1; i >= 0; i--) {
              if (assignments[i].date === assignment.date && assignments[i].shiftId === linkedShiftId) {
                const removedUser = assignments[i].assignedUsers[0];
                if (removedUser && userShiftsTracking[removedUser.id]?.[linkedShiftId]) {
                  userShiftsTracking[removedUser.id][linkedShiftId]--;
                }
                if (removedUser && userCurrentRunTracking[removedUser.id]?.[linkedShiftId]) {
                  userCurrentRunTracking[removedUser.id][linkedShiftId]--;
                }
                assignments.splice(i, 1);
              }
            }

            // Check MAX_LOAD on the linked shift before adding
            const dsMaxLoadRules = (assignedUser.rules || []).filter(
              (r: any) => r.type === 'MAX_LOAD' && r.enabled && r.config.shiftId === linkedShiftId
            );
            if (dsMaxLoadRules.length > 0) {
              const dsMaxRule = dsMaxLoadRules[0];
              const dsActiveDates = getActiveDateCount(linkedShiftId);
              const dsPct = dsMaxRule.config.maxPercentage;
              const dsMaxAssignments = Math.max(1, Math.ceil(dsActiveDates * (dsPct / 100)));
              const dsCurrent = (userShiftsTracking[assignedUser.id]?.[linkedShiftId] || 0)
                + (dsUserShiftCounts.get(`${assignedUser.id}|${linkedShiftId}`) || 0);
              if (dsCurrent >= dsMaxAssignments) continue;
            }

            dsAssignedSet.add(dsKey);
            if (linkedPikett) {
              dsAssignedSet.add(`${assignment.date}|${linkedShiftId}|*`); // Block other users for this pikett+date
            }
            const countKey = `${assignedUser.id}|${linkedShiftId}`;
            dsUserShiftCounts.set(countKey, (dsUserShiftCounts.get(countKey) || 0) + 1);
            // Mark the trigger assignment so it also shows the Link2 icon
            assignment.isDoubleShiftTrigger = true;
            passAdditions.push({
              date: assignment.date,
              shiftId: linkedShiftId,
              shift: linkedItem,
              user: { ...assignedUser, isDoubleShift: true },
              userId: assignedUser.id,
              isPikett: !!linkedPikett,
              isFromDb: !!(assignment as any).isFromDb,
            });
          }
        }
      }
      if (passAdditions.length === 0) break;
      allDoubleShiftAdditions.push(...passAdditions);
      // Feed this pass' additions into the next pass to support DS chains.
      dsSourceAssignments = passAdditions.map(ds => ({
        date: ds.date,
        shiftId: ds.shiftId,
        shift: ds.shift,
        assignedUsers: [ds.user],
        availableUsers: [],
        unavailableUsers: [],
      }));
    }
    for (const ds of allDoubleShiftAdditions) {
      assignments.push({
        date: ds.date,
        shiftId: ds.shiftId,
        shift: ds.shift,
        assignedUsers: [ds.user],
        availableUsers: [],
        unavailableUsers: [],
        isRotationAssignment: false,
        isDoubleShift: true,
        isPikett: ds.isPikett,
      });
      // Fairness counter — only DB-triggered DS is new (preview-triggered was pre-counted).
      if (ds.isFromDb) {
        if (!userShiftsTracking[ds.userId]) userShiftsTracking[ds.userId] = {};
        if (!userShiftsTracking[ds.userId][ds.shiftId]) userShiftsTracking[ds.userId][ds.shiftId] = 0;
        userShiftsTracking[ds.userId][ds.shiftId]++;
      }
      // MAX_LOAD always counts the DS (it's a real assignment for this run).
      if (!userCurrentRunTracking[ds.userId]) userCurrentRunTracking[ds.userId] = {};
      if (!userCurrentRunTracking[ds.userId][ds.shiftId]) userCurrentRunTracking[ds.userId][ds.shiftId] = 0;
      userCurrentRunTracking[ds.userId][ds.shiftId]++;
    }

    // For date+shift combos already in DB, use the actual DB users. Only take
    // active rows (PENDING/TENTATIVE/ACCEPTED). REFUSED/CANCELLED rows would
    // wrongly show the refused user as still assigned when a resend exists.
    for (const assignment of assignments) {
      const dbMatches = freshDbAssignments.filter((a: any) => {
        const status = a.status;
        if (status === 'REFUSED' || status === 'CANCELLED') return false;
        return normalizeDbDate(a.date) === assignment.date && a.shiftId === assignment.shiftId;
      });

      if (dbMatches.length > 0) {
        const dbUsers = dbMatches.map((dbA: any) => {
          const fullUser = users.find(u => u.id === dbA.userId);
          return fullUser || dbA.user || { id: dbA.userId, firstName: '?', lastName: '?', email: '' };
        });
        assignment.assignedUsers = dbUsers;
      }
    }

    setRandomSeed(prev => prev + 1);
    setShiftAssignments(assignments);

  } catch (error) {
    alert(t('processingError'));
  } finally {
    setIsProcessingShifts(false);
  }
};

  const sendShiftInvitations = async () => {
    // Date validation
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const assignmentsWithUsers = shiftAssignments.filter(a => a.assignedUsers.length > 0);

    if (assignmentsWithUsers.length === 0) {
      alert(t('noAssignmentsToSend'));
      return;
    }

    const pastAssignments = assignmentsWithUsers.filter(a => {
      const assignmentDate = new Date(a.date);
      assignmentDate.setHours(0, 0, 0, 0);
      return assignmentDate < today;
    });

    if (pastAssignments.length > 0) {
      alert(t('cannotSendPastShiftsMessage', { count: pastAssignments.length }));
      return;
    }

    // Skip assignments already saved to DB
    const newAssignments = assignmentsWithUsers.filter(a => {
      return getDateShiftStatus(a.date, a.shiftId) === null;
    });
    const skippedCount = assignmentsWithUsers.length - newAssignments.length;

    if (newAssignments.length === 0) {
      alert(t('allAssignmentsAlreadySent'));
      return;
    }

    if (skippedCount > 0) {
      const proceed = confirm(t('someAssignmentsAlreadySent', { newCount: newAssignments.length, skippedCount }));
      if (!proceed) return;
    }

    setSendingInvitations(true);

    try {
      const graphToken = await getAccessToken();
      if (!graphToken) {
        alert('Unable to get Graph access token. Please refresh and try again.');
        setSendingInvitations(false);
        return;
      }

      // STEP 1 — Send Outlook invitations in batched parallel requests.
      let outlookSuccess = 0;
      let outlookErrors = 0;
      const outlookErrorDetails: string[] = [];
      const successfulAssignments: Array<{
        date: string;
        shiftId: string;
        userId: string;
        status: string;
        outlookEventId: string;
        userEmail: string;
        shiftName: string;
        isPikett?: boolean;
        segmentStart?: string;
        segmentEnd?: string;
        segmentGroupId?: string;
        segmentIndex?: number;
      }> = [];

      // Piketts send one event per (week, user) covering the whole ISO week
      // (Mon startHour → next Mon startHour) instead of one event per day.
      const isoWeekKey = (dateStr: string): string => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const tmp = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
        const dayNum = tmp.getUTCDay() || 7;
        tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return `${tmp.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
      };
      const sendTasks: Array<{ assignment: any; user: any; weekEnd?: string }> = [];
      const pikettWeekSeen = new Set<string>();
      // Split-week support: per (pikettId, weekKey, userId) build contiguous
      // day-ranges → one Outlook event per range with correct start/end.
      const nextDayStr = (dateStr: string): string => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const jd = new Date(y, (m || 1) - 1, d || 1);
        jd.setDate(jd.getDate() + 1);
        return `${jd.getFullYear()}-${String(jd.getMonth() + 1).padStart(2, '0')}-${String(jd.getDate()).padStart(2, '0')}`;
      };
      const pikettWeekUserDates = new Map<string, Map<string, string[]>>();
      for (const a of newAssignments) {
        if (!a.isPikett) continue;
        const pikett = piketts.find((p: any) => p.id === a.shiftId);
        if (!pikett) continue;
        for (const u of a.assignedUsers) {
          const wk = isoWeekKey(a.date);
          const grpKey = `${a.shiftId}|${wk}`;
          if (!pikettWeekUserDates.has(grpKey)) pikettWeekUserDates.set(grpKey, new Map());
          const userMap = pikettWeekUserDates.get(grpKey)!;
          if (!userMap.has(u.id)) userMap.set(u.id, []);
          userMap.get(u.id)!.push(a.date);
        }
      }
      const pikettRangeInfo = new Map<string, { firstDate: string; endDate: string }[]>();
      for (const [grpKey, userMap] of pikettWeekUserDates.entries()) {
        for (const [uid, datesArr] of userMap.entries()) {
          const sorted = [...datesArr].sort();
          const ranges: { firstDate: string; endDate: string }[] = [];
          let rangeStart = sorted[0];
          let prev = sorted[0];
          for (let i = 1; i < sorted.length; i++) {
            if (sorted[i] === nextDayStr(prev)) {
              prev = sorted[i];
              continue;
            }
            ranges.push({ firstDate: rangeStart, endDate: nextDayStr(prev) });
            rangeStart = sorted[i];
            prev = sorted[i];
          }
          ranges.push({ firstDate: rangeStart, endDate: nextDayStr(prev) });
          pikettRangeInfo.set(`${grpKey}|${uid}`, ranges);
        }
      }

      for (const assignment of newAssignments) {
        for (const user of assignment.assignedUsers) {
          const pikett = assignment.isPikett ? piketts.find((p: any) => p.id === assignment.shiftId) : null;
          const useWeekMode = !!pikett;
          if (useWeekMode) {
            const wk = isoWeekKey(assignment.date);
            const rangeKey = `${assignment.shiftId}|${wk}|${user.id}`;
            const ranges = pikettRangeInfo.get(rangeKey) || [];
            // Only send once per range, on its first day.
            const match = ranges.find(r => r.firstDate === assignment.date);
            if (!match) continue;
            const key = `${assignment.shiftId}|${user.id}|${match.firstDate}`;
            if (pikettWeekSeen.has(key)) continue;
            pikettWeekSeen.add(key);
            const weekAssignment = {
              ...assignment,
              shift: {
                ...assignment.shift,
                startTime: pikett.startHour || '08:00',
                endTime: pikett.startHour || '08:00',
              },
            };
            sendTasks.push({ assignment: weekAssignment, user, weekEnd: match.endDate });
            continue;
          }
          sendTasks.push({ assignment, user });
        }
      }

      setSendProgress({ current: 0, total: sendTasks.length, success: 0, errors: 0 });

      // Graph caps concurrent requests per mailbox at ~4; batches of 3 stay safely under.
      const BATCH_SIZE = 3;
      for (let batchStart = 0; batchStart < sendTasks.length; batchStart += BATCH_SIZE) {
        const batch = sendTasks.slice(batchStart, batchStart + BATCH_SIZE);

        const batchResults = await Promise.allSettled(batch.map(async ({ assignment, user, weekEnd }: any) => {
          // A split row carries its own window; fall back to the whole shift.
          const shiftStartTime = assignment.segmentStart || assignment.shift.startTime || '00:00';
          const shiftEndTime = assignment.segmentEnd || assignment.shift.endTime || '23:59';

          const [startHour, startMinute] = shiftStartTime.split(':');
          const [endHour, endMinute] = shiftEndTime.split(':');

          // Build dates from local components to avoid TZ shifts.
          const [sy, sm, sd] = String(assignment.date).split('-').map(Number);
          const startDateTime = new Date(sy, (sm || 1) - 1, sd || 1, parseInt(startHour), parseInt(startMinute), 0);

          let endDateTime: Date;
          if (weekEnd) {
            const [ey, em, ed] = weekEnd.split('-').map(Number);
            endDateTime = new Date(ey, (em || 1) - 1, ed || 1, parseInt(endHour), parseInt(endMinute), 0);
          } else {
            endDateTime = new Date(sy, (sm || 1) - 1, sd || 1, parseInt(endHour), parseInt(endMinute), 0);
            if (endDateTime <= startDateTime) {
              endDateTime.setDate(endDateTime.getDate() + 1);
            }
          }

          const kindWord = assignment.isPikett ? 'pikett' : 'shift';
          const event = {
            subject: `${assignment.shift.name} - ${user.displayName || `${user.firstName} ${user.lastName}`}${assignment.isPikett ? ' 🛡️ PIKETT' : ''}`,
            body: {
              contentType: 'HTML',
              content: `
                <h2>${assignment.shift.name}</h2>
                <p>Please accept the invitation so that we can see that the ${kindWord} is suitable for you.</p>
                <p>If it doesn't fit, see with the other ${assignment.shift.name} engineers who can take over the ${kindWord} or you can exchange one.</p>
                <p>For any changes, please send an email to your team leader or to Mischa so that we can adjust the planning.</p>
                <p style="background:#FEF3C7;border-left:4px solid #F59E0B;padding:8px 12px;margin-top:8px;">
                  ⚠️ Always choose <strong>"Send the response now"</strong> so we can track the status.
                </p>
              `
            },
            // Wall-clock time, no Z suffix: paired with timeZone, Graph applies
            // CET or CEST itself. Sending toISOString() would hand it an absolute
            // instant built in the server's zone (UTC in the container) while
            // still labelling it Zurich — a one to two hour shift.
            start: { dateTime: localDateTime(startDateTime), timeZone: 'Europe/Zurich' },
            end: { dateTime: localDateTime(endDateTime), timeZone: 'Europe/Zurich' },
            attendees: [{
              emailAddress: { address: user.email, name: user.displayName || `${user.firstName} ${user.lastName}` },
              type: 'required'
            }],
            location: { displayName: 'Office' },
            isReminderOn: true,
            reminderMinutesBeforeStart: 1440,
            responseRequested: true,
            allowNewTimeProposals: false,
            showAs: assignment.isPikett ? 'oof' : 'busy',
            categories: [
              assignment.isPikett ? t('pikett').toUpperCase() : t('shift'),
              assignment.shift.name
            ]
          };

          const mailbox = assignment.shift.senderMailbox || 'me';

          // Exponential backoff on 429/MailboxConcurrency/5xx.
          const RETRY_DELAYS_MS = [5000, 10000, 20000];
          let lastError = '';
          for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
            const outlookResponse = await authFetch('/api/outlook/send-event', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Graph-Token': graphToken },
              body: JSON.stringify({ mailbox, event })
            });
            if (outlookResponse.ok) {
              const result = await outlookResponse.json();
              return { success: true, assignment, user, eventId: result.eventId };
            }
            const errorBody = await outlookResponse.json().catch(() => ({}));
            const graphError = errorBody?.graphError || errorBody?.error || `HTTP ${outlookResponse.status}`;
            lastError = graphError;
            const isRateLimit = outlookResponse.status === 429
              || /too many requests/i.test(graphError)
              || /mailboxconcurrency/i.test(graphError)
              || /over its .* limit/i.test(graphError);
            const isTransient = outlookResponse.status >= 500 && outlookResponse.status < 600;
            if ((isRateLimit || isTransient) && attempt < RETRY_DELAYS_MS.length) {
              await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
              continue;
            }
            return { success: false, user, error: graphError };
          }
          return { success: false, user, error: lastError };
        }));

        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value.success) {
            outlookSuccess++;
            const { assignment, user, eventId } = result.value;
            successfulAssignments.push({
              date: assignment.date,
              shiftId: assignment.shiftId,
              userId: user.id,
              status: 'PENDING',
              outlookEventId: eventId,
              userEmail: user.email,
              shiftName: assignment.shift.name,
              isPikett: !!assignment.isPikett,
              segmentStart: assignment.segmentStart,
              segmentEnd: assignment.segmentEnd,
              segmentGroupId: assignment.segmentGroupId,
              segmentIndex: assignment.segmentIndex
            });
          } else {
            outlookErrors++;
            if (result.status === 'fulfilled') {
              outlookErrorDetails.push(`${result.value.user.email}: ${result.value.error}`);
            } else {
              outlookErrorDetails.push(`Error: ${result.reason?.message || 'Unknown'}`);
            }
          }
        }

        setSendProgress({ current: batchStart + batch.length, total: sendTasks.length, success: outlookSuccess, errors: outlookErrors });
        // 1s pause between batches to soften pressure on shared mailboxes.
        if (batchStart + BATCH_SIZE < sendTasks.length) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      // STEP 2 — Only persist assignments whose invitation succeeded.
      if (successfulAssignments.length === 0) {
        const errorMessage = outlookErrors > 0
          ? `${t('noInvitationsSentError', { count: outlookErrors })}\n\n${outlookErrorDetails.join('\n')}`
          : t('noInvitationsToSend');
        setSendingInvitations(false);
        alert(errorMessage);
        return;
      }

      // Shifts and piketts land in separate tables to preserve foreign-key integrity.
      // Preview split groups carry a local id; swap it for a stable one so the
      // segments of a slot stay grouped once persisted.
      const groupIdMap = new Map<string, string>();
      const dbShiftAssignments = successfulAssignments
        .filter(a => !a.isPikett)
        .map(a => {
          let groupId: string | undefined;
          if (a.segmentGroupId) {
            if (!groupIdMap.has(a.segmentGroupId)) {
              groupIdMap.set(a.segmentGroupId, `${a.date}-${a.shiftId}-${Date.now()}`);
            }
            groupId = groupIdMap.get(a.segmentGroupId);
          }
          return {
            date: a.date,
            shiftId: a.shiftId,
            userId: a.userId,
            status: a.status,
            ...(groupId ? {
              segmentStart: a.segmentStart,
              segmentEnd: a.segmentEnd,
              segmentGroupId: groupId,
              segmentIndex: a.segmentIndex,
            } : {}),
          };
        });

      // One Outlook event covers a whole pikett week, but the DB stores one
      // row per day (so stats show 7 pikett-days). Expand accordingly.
      const persistedPikettKeys = new Set<string>();
      const dbPikettAssignments: any[] = [];
      for (const a of successfulAssignments) {
        if (!a.isPikett) continue;
        const pikett = piketts.find((p: any) => p.id === a.shiftId);
        const useWeekMode = !!pikett;
        const primaryKey = `${a.shiftId}|${a.userId}|${a.date}`;
        if (!persistedPikettKeys.has(primaryKey)) {
          persistedPikettKeys.add(primaryKey);
          dbPikettAssignments.push({ date: a.date, pikettId: a.shiftId, userId: a.userId, status: a.status });
        }
        if (!useWeekMode) continue;
        const weekKeyOfSend = isoWeekKey(a.date);
        const weekAssignments = assignmentsWithUsers.filter((sa: any) =>
          sa.isPikett && sa.shiftId === a.shiftId &&
          sa.assignedUsers.some((u: any) => u.id === a.userId)
        );
        for (const sa of weekAssignments) {
          if (isoWeekKey(sa.date) !== weekKeyOfSend) continue;
          const key = `${a.shiftId}|${a.userId}|${sa.date}`;
          if (persistedPikettKeys.has(key)) continue;
          persistedPikettKeys.add(key);
          dbPikettAssignments.push({ date: sa.date, pikettId: a.shiftId, userId: a.userId, status: a.status });
        }
      }

      let shiftResult: any = { assignments: [] };
      let pikettResult: any = { assignments: [] };

      if (dbShiftAssignments.length > 0) {
        const response = await authFetch('/api/shift-assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignments: dbShiftAssignments })
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to save shift assignments');
        }
        shiftResult = await response.json();
      }

      if (dbPikettAssignments.length > 0) {
        const response = await authFetch('/api/pikett-assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignments: dbPikettAssignments })
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to save pikett assignments');
        }
        pikettResult = await response.json();
      }

      // STEP 3 — PATCH each DB row with its outlookEventId. Week-mode piketts
      // link a single event to its contiguous range (split-week aware).
      for (const successfulAssignment of successfulAssignments) {
        const list = successfulAssignment.isPikett ? pikettResult.assignments : shiftResult.assignments;
        const idField = successfulAssignment.isPikett ? 'pikettId' : 'shiftId';
        const pikett = successfulAssignment.isPikett
          ? piketts.find((p: any) => p.id === successfulAssignment.shiftId)
          : null;
        const useWeekMode = !!pikett;
        const sendWeek = isoWeekKey(successfulAssignment.date);
        let rangeDates: Set<string> | null = null;
        if (useWeekMode) {
          const rk = `${successfulAssignment.shiftId}|${sendWeek}|${successfulAssignment.userId}`;
          const ranges = pikettRangeInfo.get(rk) || [];
          const match = ranges.find(r => r.firstDate === successfulAssignment.date);
          if (match) {
            rangeDates = new Set<string>();
            let cur = match.firstDate;
            while (cur !== match.endDate) {
              rangeDates.add(cur);
              cur = nextDayStr(cur);
            }
          }
        }
        const matches = list.filter((a: any) => {
          const userMatch = a.userId === successfulAssignment.userId;
          const idMatch = a[idField] === successfulAssignment.shiftId;
          if (!userMatch || !idMatch) return false;
          const dbDateStr = new Date(a.date).toISOString().split('T')[0];
          if (useWeekMode && rangeDates) return rangeDates.has(dbDateStr);
          return dbDateStr === successfulAssignment.date;
        });
        for (const foundAssignment of matches) {
          const patchUrl = successfulAssignment.isPikett
            ? `/api/pikett-assignments/${foundAssignment.id}`
            : `/api/shift-assignments/${foundAssignment.id}`;
          await authFetch(patchUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ outlookEventId: successfulAssignment.outlookEventId })
          });
        }
      }

      fetchDbAssignments();

      setSuccessMessage({
        outlookSuccess,
        outlookErrors,
        outlookErrorDetails,
        dbCount: (shiftResult.count || 0) + (pikettResult.count || 0)
      });
      setShowSuccessDialog(true);
      setSendingInvitations(false);

    } catch (error) {
      setSendingInvitations(false);
      alert(`${t('errorSendingInvitations')}\n${error instanceof Error ? error.message : t('unknownError')}`);
    }
  };

  const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month: number, year: number) => new Date(year, month, 1).getDay();

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(calendarMonth, calendarYear);
    const firstDay = getFirstDayOfMonth(calendarMonth, calendarYear);
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
    const days: (number | null)[] = Array(adjustedFirstDay).fill(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const getAssignmentsForDate = (day: number): ShiftAssignment[] => {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return shiftAssignments.filter(a => a.date === dateStr);
  };

const CalendarDay = ({ day }: { day: number | null }) => {
  // Empty cells mirror the populated-cell border so the first-week row looks consistent.
  if (!day) return (
    <div className={`${expandedCalendar ? 'min-h-[160px]' : 'min-h-[96px]'} border border-slate-200 rounded-lg bg-slate-50/40`}></div>
  );
  
  const assignments = getAssignmentsForDate(day);
  const isToday = new Date().getDate() === day && 
                  new Date().getMonth() === calendarMonth && 
                  new Date().getFullYear() === calendarYear;
  
  // Piketts first, then shifts sorted by name.
  const sortedAssignments = [...assignments].sort((a, b) => {
    if (a.isPikett && !b.isPikett) return -1;
    if (!a.isPikett && b.isPikett) return 1;
    const byName = (a.shift?.name || a.shiftId).localeCompare(b.shift?.name || b.shiftId);
    if (byName !== 0) return byName;
    // Same shift: keep split segments in chronological order.
    return (a.segmentIndex ?? 0) - (b.segmentIndex ?? 0);
  });
  const maxVisible = expandedCalendar ? sortedAssignments.length : 3;
  const visibleAssignments = sortedAssignments.slice(0, maxVisible);
  const hiddenCount = sortedAssignments.length - maxVisible;
  
  return (
    <div
      className={`${expandedCalendar ? 'min-h-[160px]' : 'min-h-[96px]'} border rounded-lg p-1.5 cursor-pointer transition-all overflow-hidden
        ${isToday ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}
        ${assignments.length > 0 ? 'hover:shadow-md' : 'hover:bg-slate-50'}`}
      onClick={() => {
        if (assignments.length > 0) {
          setSelectedDayAssignments(assignments.map(a => ({...a})));
          setTempShiftAssignments([...shiftAssignments]);
          setIsDetailDialogOpen(true);
        }
      }}
    >
      <div className="text-xs font-medium text-slate-700 mb-1 flex items-center justify-between">
        <span>{day}</span>
        {assignments.length > 0 && (
          <Badge variant="outline" className="text-xs h-4 px-1">
            {assignments.length}
          </Badge>
        )}
      </div>
      
      <div className="space-y-0.5">
        {visibleAssignments.map((assignment, idx) => {
          // pikett=rose, double-shift=teal, otherwise the shift's own color.
          let color = assignment.isPikett ? '#e11d48' : assignment.isDoubleShift ? '#0d9488' : (assignment.shift?.color || '#6b7280');

          return (
            <div
              key={`${assignment.shiftId}-${idx}`}
              className="rounded px-1 py-0.5 text-xs truncate relative"
              style={{
                backgroundColor: `${color}15`,
                borderLeft: `2px solid ${color}`
              }}
            >
              <div className="flex items-center gap-0.5">
                {(assignment.isDoubleShift || assignment.isDoubleShiftTrigger) && (
                  <Link2 className="w-3 h-3 flex-shrink-0" style={{ color: '#0d9488' }} />
                )}
                {assignment.isPikett && (
                  <Shield className="w-3 h-3 flex-shrink-0 text-rose-600" />
                )}
                {assignment.isRotationAssignment && !assignment.isPikett && !assignment.isDoubleShift && (
                  <RotateCw className="w-3 h-3 flex-shrink-0" style={{ color }} />
                )}
                {assignment.segmentGroupId && (
                  <Scissors className="w-3 h-3 flex-shrink-0 text-amber-600" />
                )}
                <span
                  style={{ color }}
                  className="font-medium text-xs truncate"
                >
                  {assignment.shift?.name || 'Shift'}
                </span>
                {assignment.segmentStart && (
                  <span className="text-[10px] text-amber-700 flex-shrink-0 whitespace-nowrap">
                    {assignment.segmentStart}-{assignment.segmentEnd}
                  </span>
                )}
                {assignment.assignedUsers.length > 0 ? (
                  <>
                    <span className="text-slate-700 truncate text-xs">
                      : {assignment.assignedUsers[0].firstName} {assignment.assignedUsers[0].lastName}
                    </span>
                    {(() => {
                      const status = getDateShiftStatus(assignment.date, assignment.shiftId, assignment.assignedUsers[0]?.id);
                      if (!status) return null;
                      const dotColor = status === 'ACCEPTED' ? 'bg-green-500' : status === 'REFUSED' ? 'bg-red-500' : status === 'TENTATIVE' ? 'bg-orange-500' : status === 'PENDING' ? 'bg-blue-500' : 'bg-gray-400';
                      return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} title={t(`status${status.charAt(0) + status.slice(1).toLowerCase()}`)} />;
                    })()}
                  </>
                ) : (
                  <span className="text-orange-600 text-xs">: ⚠</span>
                )}
              </div>
            </div>
          );
        })}
        {hiddenCount > 0 && (
          <div className="text-xs text-slate-500 text-center font-medium">
            +{hiddenCount} more
          </div>
        )}
      </div>
    </div>
  );
};

  useEffect(() => {
    fetchUsersFromCalendars();
  }, [users]);

  useEffect(() => {
    localStorage.setItem('shiftSettings', JSON.stringify(settings));
  }, [settings]);

useEffect(() => {
  if (typeof window !== 'undefined') {
    const clientSettings = loadSettings();
    setSettings(clientSettings);
  }
  // Cross-page sync — refresh when the Settings page (or another tab) changes shiftSettings
  const onStorage = (e: StorageEvent) => {
    if (e.key === 'shiftSettings' && e.newValue) {
      try { setSettings(JSON.parse(e.newValue)); } catch {}
    }
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}, []);

  if (shiftsLoading || usersLoading || teamsLoading || holidaysLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      
      <main className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">{t('title')}</h1>
          </div>
          
        </div>

        {/* Configuration and Calendar in the same view */}
        <div className={`grid grid-cols-1 gap-6 ${showConfiguration ? 'xl:grid-cols-4' : ''}`}>
          {/* Configuration panel on the left */}
          {showConfiguration && (
          <div className="xl:col-span-1">
            <Card className="bg-white border-0 shadow-sm sticky top-6">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-slate-800">
                  <Calendar className="w-5 h-5 mr-2 text-blue-600 inline" />
                  {t('configuration')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-medium text-slate-800">{t('period')}</h3>
                  <div className="space-y-4">
                    <div>
                      <Label>{t('startDate')}</Label>
                      <Input
                        type="date"
                        value={startDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          const error = validateDates(e.target.value, endDate);
                          setDateError(error);
                        }}
                        className={dateError ? 'border-red-500' : ''}
                      />
                    </div>
                    <div>
                      <Label>{t('endDate')}</Label>
                      <Input
                        type="date"
                        value={endDate}
                        min={startDate || new Date().toISOString().split('T')[0]}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          const error = validateDates(startDate, e.target.value);
                          setDateError(error);
                        }}
                        className={dateError ? 'border-red-500' : ''}
                      />
                    </div>
                    {dateError && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <p className="text-sm text-red-700">{dateError}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                {/* Section Shifts */}
                <div className="space-y-2">
                  <div className="flex flex-col items-start mb-4 gap-2">
                    <label className="w-full">{t('shiftsToSchedule')}</label>
                    <div className="flex w-full flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto hover:bg-secondary/20"
                        onClick={() => {
                          const activeShifts = shifts.filter((s: any) => s.status === 'ACTIVE');
                          setSelectedShifts(activeShifts.map((s: any) => s.id));
                        }}
                      >
                        {t('selectAll')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto hover:bg-secondary/20"
                        onClick={() => setSelectedShifts([])}
                      >
                        {t('deselectAll')}
                      </Button>
                    </div>
                  </div>
                  
                  <ScrollArea className="h-auto border rounded-lg p-2">
                    <div className="space-y-2">
                      {shifts.filter((s: any) => s.status === 'ACTIVE').map((shift: any) => {
                        const isSelected = selectedShifts.includes(shift.id);
                        const color = shift.color || '#6b7280';
                        
                        return (
                          <label
                            key={shift.id}
                            className={`flex items-center space-x-2 p-1.5 rounded cursor-pointer text-xs
                              ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedShifts([...selectedShifts, shift.id]);
                                } else {
                                  setSelectedShifts(selectedShifts.filter((id: string) => id !== shift.id));
                                }
                              }}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                                <span className="font-medium">{shift.name}</span>
                              </div>
                              <span className="text-xs text-slate-500">
                                {shift.startTime} - {shift.endTime}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>

                {/* Section Piketts */}
                <div className="space-y-2">
                  <div className="flex flex-col items-start mb-4 gap-2">
                    <Label className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-red-600" />
                      {t('pikettToSchedule')}
                    </Label>
                    <div className="flex w-full flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto hover:bg-secondary/20"
                        onClick={() => {
                          const activePiketts = piketts.filter((p: any) => p.status === 'ACTIVE');
                          setSelectedPiketts(activePiketts.map((p: any) => p.id));
                        }}
                      >
                        {t('selectAll')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto hover:bg-secondary/20"
                        onClick={() => setSelectedPiketts([])}
                      >
                        {t('deselectAll')}
                      </Button>
                    </div>
                  </div>
                  
                  <ScrollArea className="h-auto border rounded-lg p-2 bg-rose-50/30">
                    <div className="space-y-2">
                      {piketts.filter((p: any) => p.status === 'ACTIVE').map((pikett: any) => {
                        const isSelected = selectedPiketts.includes(pikett.id);

                        return (
                          <label
                            key={pikett.id}
                            className={`flex items-center space-x-2 p-1.5 rounded cursor-pointer text-xs
                              ${isSelected ? 'bg-rose-100' : 'hover:bg-rose-50'}`}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedPiketts([...selectedPiketts, pikett.id]);
                                } else {
                                  setSelectedPiketts(selectedPiketts.filter((id: string) => id !== pikett.id));
                                }
                              }}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-1">
                                <Shield className="w-3 h-3 text-rose-600" />
                                <span className="font-medium text-rose-900">{pikett.name}</span>
                              </div>
                              <span className="text-xs text-rose-700">
                                {pikett.team?.name} • 24/7
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              </div>

                <div className="space-y-3 pt-4 border-t">
                  <Button
                    onClick={processShiftAssignments}
                    disabled={isProcessingShifts || (selectedShifts.length === 0 && selectedPiketts.length === 0) || !startDate || !endDate || !!dateError}
                    className="w-full bg-primary hover:bg-primary/90"
>
                    {isProcessingShifts ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        {t('processing')}
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-2" />
                        {t('preview')}
                      </>
                    )}
                  </Button>

                  {shiftAssignments.length > 0 && (() => {
                    // Count by date+shift (not per-user)
                    const assignmentsWithUsers = shiftAssignments.filter(a => a.assignedUsers.length > 0);
                    const newCount = assignmentsWithUsers.filter(a => getDateShiftStatus(a.date, a.shiftId) === null).length;
                    const alreadySentCount = assignmentsWithUsers.filter(a => getDateShiftStatus(a.date, a.shiftId) !== null).length;

                    return (
                      <div className="space-y-2">
                        <Button
                          onClick={sendShiftInvitations}
                          disabled={sendingInvitations || newCount === 0}
                          className="w-full bg-[#00ff7b] text-black hover:bg-[#00ff7b]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {sendingInvitations ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {t('sendingInProgress')}
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              {t('sendInvitations')}
                            </>
                          )}
                        </Button>
                        {alreadySentCount > 0 && (
                          <p className="text-xs text-slate-500 text-center">
                            {newCount > 0
                              ? t('newAndAlreadySentCount', { newCount, alreadySentCount })
                              : t('allAlreadySentCount', { count: alreadySentCount })
                            }
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>
          )}

          {/* Calendar and statistics on the right */}
          <div className={`space-y-6 ${showConfiguration ? 'xl:col-span-3' : ''}`}>
            {/* Statistics */}
            {shiftAssignments.length > 0 && (
              <Card className="bg-white border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-800">
                    {t('assignmentSummary')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {selectedShifts.map((shiftId) => {
                      const shift = shifts.find((s: any) => s.id === shiftId);
                      const count = shiftAssignments.filter(a =>
                        a.shiftId === shiftId && !a.isPikett && a.assignedUsers.length > 0
                      ).length;
                      const rotationCount = shiftAssignments.filter(a =>
                        a.shiftId === shiftId && !a.isPikett && a.isRotationAssignment
                      ).length;
                      const emptyCount = shiftAssignments.filter(a =>
                        a.shiftId === shiftId && !a.isPikett && a.assignedUsers.length === 0
                      ).length;

                      return (
                        <div
                          key={shiftId}
                          className="text-center p-3 rounded-lg relative"
                          style={{ backgroundColor: `${shift?.color || '#6b7280'}15` }}
                        >
                          <div
                            className="text-sm font-medium mb-1 truncate"
                            style={{ color: shift?.color || '#6b7280' }}
                          >
                            {shift?.name}
                          </div>
                          <div className="text-lg font-bold text-green-600">
                            {count}
                          </div>
                          <p className="text-xs text-green-700">{t('assigned')}</p>
                          <div className="flex items-center justify-center gap-2 mt-1">
                            {rotationCount > 0 && (
                              <Badge className="bg-orange-100 text-orange-700 text-xs border-0">
                                <RotateCw className="w-3 h-3 mr-0.5" />
                                {rotationCount}
                              </Badge>
                            )}
                            {emptyCount > 0 && (
                              <Badge className="bg-orange-100 text-orange-700 text-xs border-0">
                                ⚠ {emptyCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {selectedPiketts.map((pikettId) => {
                      const pikett = piketts.find((p: any) => p.id === pikettId);
                      const count = shiftAssignments.filter(a =>
                        a.shiftId === pikettId && a.isPikett && a.assignedUsers.length > 0
                      ).length;
                      const rotationCount = shiftAssignments.filter(a =>
                        a.shiftId === pikettId && a.isPikett && a.isRotationAssignment
                      ).length;
                      const emptyCount = shiftAssignments.filter(a =>
                        a.shiftId === pikettId && a.isPikett && a.assignedUsers.length === 0
                      ).length;

                      return (
                        <div
                          key={pikettId}
                          className="text-center p-3 rounded-lg relative border border-rose-200"
                          style={{ backgroundColor: '#fecdd315' }}
                        >
                          <div className="text-sm font-medium mb-1 truncate flex items-center justify-center gap-1 text-rose-700">
                            <Shield className="w-3.5 h-3.5" />
                            {pikett?.name}
                          </div>
                          <div className="text-lg font-bold text-rose-600">
                            {count}
                          </div>
                          <p className="text-xs text-rose-700">{t('assigned')}</p>
                          <div className="flex items-center justify-center gap-2 mt-1">
                            {rotationCount > 0 && (
                              <Badge className="bg-orange-100 text-orange-700 text-xs border-0">
                                <RotateCw className="w-3 h-3 mr-0.5" />
                                {rotationCount}
                              </Badge>
                            )}
                            {emptyCount > 0 && (
                              <Badge className="bg-orange-100 text-orange-700 text-xs border-0">
                                ⚠ {emptyCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Assignments per user (preview overview) */}
            {shiftAssignments.length > 0 && (() => {
              // Aggregate preview counts per user, with a per-shift breakdown for the expanded view.
              type UserRow = { user: any; count: number; total: number; perShift: Map<string, { name: string; color?: string; isPikett: boolean; count: number }> };
              const perUser = new Map<string, UserRow>();
              for (const a of shiftAssignments) {
                for (const u of a.assignedUsers) {
                  if (!u?.id) continue;
                  let row = perUser.get(u.id);
                  if (!row) {
                    row = { user: u, count: 0, total: 0, perShift: new Map() };
                    perUser.set(u.id, row);
                  }
                  // A split segment counts for the share of the shift it covers,
                  // rounded to the nearest half so the figures stay readable:
                  // 0.5 or 1, never 0.4 or 0.7.
                  const weight = (() => {
                    const seg = a as any;
                    if (!seg.segmentStart || !a.shift?.startTime) return 1;
                    const mins = (t2: string) => {
                      const [h, m] = t2.slice(0, 5).split(':').map(Number);
                      return h * 60 + m;
                    };
                    const full = mins(a.shift.endTime) - mins(a.shift.startTime);
                    if (full <= 0) return 1;
                    const part = mins(seg.segmentEnd) - mins(seg.segmentStart);
                    return Math.max(0.5, Math.round((part / full) * 2) / 2);
                  })();
                  row.count += weight;
                  const sid = a.shiftId;
                  const key = sid;
                  const existing = row.perShift.get(key);
                  if (existing) existing.count += weight;
                  else row.perShift.set(key, {
                    name: a.shift?.name || t('shift'),
                    color: a.shift?.color,
                    isPikett: !!(a as any).isPikett,
                    count: weight,
                  });
                }
              }
              for (const [uid, entry] of perUser.entries()) {
                const activeShift = dbAssignments.filter((a: any) => a.userId === uid && a.status !== 'CANCELLED' && a.status !== 'REFUSED').length;
                const activePikett = dbPikettAssignments.filter((a: any) => a.userId === uid && a.status !== 'CANCELLED' && a.status !== 'REFUSED').length;
                entry.total = activeShift + activePikett;
              }
              const rows = Array.from(perUser.values()).sort((a, b) => b.count - a.count);
              // Whole numbers stay bare, halves show one decimal: 4 and 4.5.
              const fmtCount = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
              return (
                <Card className="bg-white border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      {t('assignmentsPerUser')}
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        ({rows.length} {rows.length === 1 ? t('user') : t('users')})
                      </span>
                      <span className="ml-1 text-[11px] font-normal text-slate-400">
                        · {t('clickForDetails')}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {rows.map(({ user, count, total, perShift }) => {
                        const isJoker = (user.workPercent ?? 100) === 0;
                        const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
                        const isExpanded = expandedAssignmentUserId === user.id;
                        const shiftBreakdown = Array.from(perShift.values()).sort((a, b) => b.count - a.count);
                        return (
                          <div
                            key={user.id}
                            className={`rounded-md transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50 ring-1 ring-blue-200' : 'bg-slate-50 hover:bg-slate-100'}`}
                            onClick={() => setExpandedAssignmentUserId(isExpanded ? null : user.id)}
                          >
                            <div className="flex items-center gap-2 p-2">
                              <Avatar className="w-8 h-8 flex-shrink-0">
                                <AvatarFallback className={`text-xs ${isJoker ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {initials || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate flex items-center gap-1">
                                  {user.firstName} {user.lastName}
                                  {isJoker && <span className="text-purple-600 text-xs">🃏</span>}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {fmtCount(count)} {count === 1 ? t('shift') : t('shifts')}
                                  {total > 0 && (
                                    <span className="ml-1 text-slate-400">
                                      · {t('historyTotal', { count: total })}
                                    </span>
                                  )}
                                </p>
                              </div>
                              <span className="text-lg font-semibold text-blue-600 tabular-nums">
                                {fmtCount(count)}
                              </span>
                              <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </div>
                            {isExpanded && (
                              <div className="px-2 pb-2 pt-1 border-t border-blue-100 space-y-1">
                                {shiftBreakdown.map((s, i) => (
                                  <div key={i} className="flex items-center justify-between text-xs pl-10">
                                    <span className="flex items-center gap-1.5 truncate">
                                      <span
                                        className="w-2 h-2 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: s.color || (s.isPikett ? '#e11d48' : '#3b82f6') }}
                                      />
                                      <span className="truncate text-slate-700">{s.name}</span>
                                      {s.isPikett && (
                                        <span className="text-[9px] uppercase tracking-wide text-rose-600 font-medium">
                                          {t('pikett')}
                                        </span>
                                      )}
                                    </span>
                                    <span className="text-slate-500 tabular-nums">{fmtCount(s.count)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Calendar */}
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-3">
                  {/* < Month Year > + Today */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-green-100 hover:text-green-700"
                      onClick={() => {
                        if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(calendarYear - 1); }
                        else setCalendarMonth(calendarMonth - 1);
                      }}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <CardTitle className="text-xl font-semibold text-slate-800 capitalize whitespace-nowrap min-w-[150px] text-center">
                      {new Date(calendarYear, calendarMonth).toLocaleDateString(locale, {
                        month: 'long',
                        year: 'numeric'
                      })}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-green-100 hover:text-green-700"
                      onClick={() => {
                        if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(calendarYear + 1); }
                        else setCalendarMonth(calendarMonth + 1);
                      }}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      setCalendarMonth(today.getMonth());
                      setCalendarYear(today.getFullYear());
                    }}
                    className="h-8 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                  >
                    {t('today')}
                  </Button>
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowConfiguration(!showConfiguration)}
                      title={showConfiguration ? t('hideConfiguration') : t('showConfiguration')}
                      className="hover:bg-secondary/20"
                    >
                      {showConfiguration ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowWeekendDays(!showWeekendDays)}
                      title={showWeekendDays ? t('workDays') : t('allWeek')}
                      className="hover:bg-secondary/20"
                    >
                      {showWeekendDays ? <CalendarDays className="w-4 h-4" /> : <CalendarRange className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandedCalendar(!expandedCalendar)}
                      title={expandedCalendar ? t('reduce') : t('enlarge')}
                      className="hover:bg-secondary/20"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                    <Dialog open={isSettingsDialogOpen} onOpenChange={(open) => {
                      // Re-sync from localStorage when opening — captures changes made from the Settings page.
                      if (open) setSettings(loadSettings());
                      setIsSettingsDialogOpen(open);
                    }}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="hover:bg-secondary/20"
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t('planningSettings')}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          {/* Order kept in sync with the Settings page */}
                          <div className="flex items-center justify-between">
                            <Label htmlFor="balance">{t('fairDistribution')}</Label>
                            <Checkbox
                              id="balance"
                              checked={settings.balanceShifts}
                              onCheckedChange={(checked) =>
                                setSettings({...settings, balanceShifts: !!checked})
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="check-cal">{t('checkCalendars')}</Label>
                            <Checkbox
                              id="check-cal"
                              checked={settings.checkCalendars}
                              onCheckedChange={(checked) =>
                                setSettings({...settings, checkCalendars: !!checked})
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="priority">{t('prioritySystem')}</Label>
                            <Checkbox
                              id="priority"
                              checked={settings.prioritySystem}
                              onCheckedChange={(checked) =>
                                setSettings({...settings, prioritySystem: !!checked})
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="enable-rotations">{t('enableRotations')}</Label>
                            <Checkbox
                              id="enable-rotations"
                              checked={settings.enableRotations}
                              onCheckedChange={(checked) =>
                                setSettings({...settings, enableRotations: !!checked})
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="work-pct">{t('respectWorkPercentage')}</Label>
                            <Checkbox
                              id="work-pct"
                              checked={settings.respectWorkPercentage}
                              onCheckedChange={(checked) =>
                                setSettings({...settings, respectWorkPercentage: !!checked})
                              }
                            />
                          </div>
                          <div className="flex justify-end pt-4 border-t">
                            <Button
                              onClick={() => setIsSettingsDialogOpen(false)}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              {tCommon('validate')}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className={`grid gap-1 ${showWeekendDays ? 'grid-cols-7' : 'grid-cols-5'}`}>
                  {(showWeekendDays
                    ? [t('mon'), t('tue'), t('wed'), t('thu'), t('fri'), t('sat'), t('sun')]
                    : [t('mon'), t('tue'), t('wed'), t('thu'), t('fri')]
                  ).map(day => (
                    <div key={day} className="text-center text-sm font-medium text-slate-600 py-2">
                      {day}
                    </div>
                  ))}
                  {generateCalendarDays().map((day, index) => {
                    if (!showWeekendDays) {
                      if (day === null) {
                        // For empty cells, determine if it's a weekend
                        const firstDay = getFirstDayOfMonth(calendarMonth, calendarYear);
                        const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
                        const dayOfWeek = (index % 7);
                        // 5 = Saturday, 6 = Sunday (in our Mon-Sun view)
                        if (dayOfWeek === 5 || dayOfWeek === 6) {
                          return null;
                        }
                      } else {
                        const date = new Date(calendarYear, calendarMonth, day);
                        const dayOfWeek = date.getDay();
                        // 0 = Sunday, 6 = Saturday
                        if (dayOfWeek === 0 || dayOfWeek === 6) {
                          return null;
                        }
                      }
                    }
                    return <CalendarDay key={index} day={day} />;
                  })}
                </div>
                
                {/* Legend */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <RotateCw className="w-3 h-3 text-orange-600" />
                      <span className="text-slate-600">{t('automaticRotation')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-violet-600" />
                      <span className="text-slate-600">{t('outOfOffice')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Shield className="w-3 h-3 text-rose-600" />
                      <span className="text-slate-600">Pikett</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Link2 className="w-3 h-3 text-teal-600" />
                      <span className="text-slate-600">{t('doubleShiftAuto')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Scissors className="w-3 h-3 text-amber-600" />
                      <span className="text-slate-600">{t('splitBadge')}</span>
                    </div>
                    <div className="border-l pl-4 flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-slate-600">{t('statusNoAnswer')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                        <span className="text-slate-600">{t('statusTentative')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-slate-600">{t('statusAccepted')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-slate-600">{t('statusRefused')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Compact grid: Users with rotation + Out of Office */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Users with rotation (only members of selected shifts) */}
              {(() => {
                const memberIds = getSelectedShiftsMemberIds();
                const rotationUsers = availableUsers.filter(u => u.rotationConfig?.patternId && memberIds.has(u.id) && (u.status === 'ACTIVE' || u.status === 'active'));
                return rotationUsers.length > 0 ? (
                <Card className="bg-white border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-slate-800 flex items-center">
                      <RotateCw className="w-4 h-4 mr-2 text-orange-600" />
                      {t('usersWithRotationCount', { count: rotationUsers.length })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[280px] overflow-y-auto pr-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                      {rotationUsers
                        .map(user => {
                          const pattern = rotationPatterns.find(p => p.id === user.rotationConfig.patternId);
                          const allowedTypes = (user.rotationConfig?.allowedShiftTypes || []) as string[];
                          const allowedNames = allowedTypes
                            .map(id => shifts.find(s => s.id === id)?.name)
                            .filter(Boolean) as string[];
                          return (
                            <div key={user.id} className="flex items-center gap-2 px-2 py-1.5 bg-gradient-to-r from-orange-50 to-amber-50 rounded-md">
                              <Avatar className="w-6 h-6 flex-shrink-0">
                                <AvatarFallback className="text-[10px] bg-gradient-to-br from-orange-500 to-amber-600 text-white">
                                  {user.firstName?.[0]}{user.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate">
                                  {user.firstName} {user.lastName}
                                  <span className="ml-1.5 text-[11px] font-normal text-slate-500">· {pattern?.name || t('unknownPattern')}</span>
                                </p>
                                {allowedNames.length > 0 && (
                                  <p className="text-[10px] text-slate-500 truncate">{allowedNames.join(', ')}</p>
                                )}
                              </div>
                              <span className="text-[10px] font-medium text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                                {pattern?.cycleLength || 0} sem.
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              ) : null})()}

              {/* Users Out of Office (only members of selected shifts) */}
              {startDate && endDate && ((() => {
                const memberIds = getSelectedShiftsMemberIds();
                return (
                <Card className="bg-white border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-slate-800 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-2 text-violet-600" />
                      {t('outOfOffice')} ({(() => {
                        const usersOOF = new Set<string>();
                        const eligibleDaysCache = new Map<string, Set<number>>();
                        const getEligibleDays = (user: any): Set<number> => {
                          const cached = eligibleDaysCache.get(user.id);
                          if (cached) return cached;
                          const days = new Set<number>();
                          for (const shiftId of selectedShifts) {
                            const shift = shifts.find(s => s.id === shiftId);
                            if (!shift) continue;
                            const inTeam = user.teamId === shift.teamId;
                            const included = (shift as any).includedUserIds?.includes(user.id);
                            const excluded = (shift as any).excludedUserIds?.includes(user.id);
                            if ((inTeam && !excluded) || included) {
                              (shift.daysOfWeek || [1, 2, 3, 4, 5]).forEach((d: number) => days.add(d));
                            }
                          }
                          for (const pikettId of selectedPiketts) {
                            const pikett = piketts.find(p => p.id === pikettId);
                            if (!pikett) continue;
                            const inTeam = user.teamId === pikett.teamId;
                            const included = (pikett as any).includedUserIds?.includes(user.id);
                            const excluded = (pikett as any).excludedUserIds?.includes(user.id);
                            if ((inTeam && !excluded) || included) {
                              // Piketts always cover the full week (Mon→Mon)
                              [0, 1, 2, 3, 4, 5, 6].forEach((d: number) => days.add(d));
                            }
                          }
                          eligibleDaysCache.set(user.id, days);
                          return days;
                        };
                        outOfOfficeEvents
                          .filter((e: OutlookEvent) => isTrueOOF(e))
                          .forEach((event: OutlookEvent) => {
                            const eventStart = new Date(event.start.dateTime);
                            const eventEnd = new Date(event.end.dateTime);
                            const periodStart = new Date(startDate);
                            const periodEnd = new Date(endDate);

                            if (eventStart <= periodEnd && eventEnd >= periodStart) {
                              const userEmail = event.organizer?.emailAddress?.address?.toLowerCase();
                              const user = availableUsers.find(u => u.email?.toLowerCase() === userEmail);
                              if (user && memberIds.has(user.id)) {
                                const eligibleDays = getEligibleDays(user);
                                if (eligibleDays.size === 0) return;
                                const rangeStart = new Date(Math.max(eventStart.getTime(), periodStart.getTime()));
                                const rangeEnd = new Date(Math.min(eventEnd.getTime(), periodEnd.getTime()));
                                const d = new Date(rangeStart); d.setHours(0, 0, 0, 0);
                                const endDay = new Date(rangeEnd); endDay.setHours(0, 0, 0, 0);
                                let overlaps = false;
                                while (d.getTime() <= endDay.getTime()) {
                                  if (eligibleDays.has(d.getDay())) { overlaps = true; break; }
                                  d.setDate(d.getDate() + 1);
                                }
                                if (!overlaps) return;
                                usersOOF.add(userEmail || '');
                              }
                            }
                          });
                        return usersOOF.size;
                      })()})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[280px] overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                      {(() => {
                        // Group events by user
                        const userEventsMap = new Map<string, { user: any; events: OutlookEvent[] }>();

                        // Only show real OOF events (not busy from shifts)
                        // For each user, compute the union of daysOfWeek across shifts/piketts they are eligible for
                        const userEligibleDaysCache = new Map<string, Set<number>>();
                        const getUserEligibleDays = (user: any): Set<number> => {
                          const cached = userEligibleDaysCache.get(user.id);
                          if (cached) return cached;
                          const days = new Set<number>();
                          for (const shiftId of selectedShifts) {
                            const shift = shifts.find(s => s.id === shiftId);
                            if (!shift) continue;
                            const inTeam = user.teamId === shift.teamId;
                            const included = (shift as any).includedUserIds?.includes(user.id);
                            const excluded = (shift as any).excludedUserIds?.includes(user.id);
                            if ((inTeam && !excluded) || included) {
                              (shift.daysOfWeek || [1, 2, 3, 4, 5]).forEach((d: number) => days.add(d));
                            }
                          }
                          for (const pikettId of selectedPiketts) {
                            const pikett = piketts.find(p => p.id === pikettId);
                            if (!pikett) continue;
                            const inTeam = user.teamId === pikett.teamId;
                            const included = (pikett as any).includedUserIds?.includes(user.id);
                            const excluded = (pikett as any).excludedUserIds?.includes(user.id);
                            if ((inTeam && !excluded) || included) {
                              // Piketts always cover the full week
                              [0, 1, 2, 3, 4, 5, 6].forEach((d: number) => days.add(d));
                            }
                          }
                          userEligibleDaysCache.set(user.id, days);
                          return days;
                        };

                        // Check if any day of the OOF period falls on a user-eligible weekday
                        const oofOverlapsEligibleDay = (eventStart: Date, eventEnd: Date, eligibleDays: Set<number>): boolean => {
                          if (eligibleDays.size === 0) return false;
                          const periodStart = new Date(startDate);
                          const periodEnd = new Date(endDate);
                          const rangeStart = new Date(Math.max(eventStart.getTime(), periodStart.getTime()));
                          const rangeEnd = new Date(Math.min(eventEnd.getTime(), periodEnd.getTime()));
                          const d = new Date(rangeStart);
                          d.setHours(0, 0, 0, 0);
                          const endDay = new Date(rangeEnd);
                          endDay.setHours(0, 0, 0, 0);
                          while (d.getTime() <= endDay.getTime()) {
                            if (eligibleDays.has(d.getDay())) return true;
                            d.setDate(d.getDate() + 1);
                          }
                          return false;
                        };

                        outOfOfficeEvents
                          .filter((e: OutlookEvent) => isTrueOOF(e))
                          .forEach((event: OutlookEvent) => {
                            const eventStart = new Date(event.start.dateTime);
                            const eventEnd = new Date(event.end.dateTime);
                            const periodStart = new Date(startDate);
                            const periodEnd = new Date(endDate);

                            if (eventStart <= periodEnd && eventEnd >= periodStart) {
                              const userEmail = event.organizer?.emailAddress?.address?.toLowerCase();
                              if (userEmail) {
                                const user = availableUsers.find(u => u.email?.toLowerCase() === userEmail);
                                if (user && memberIds.has(user.id)) {
                                  const eligibleDays = getUserEligibleDays(user);
                                  if (!oofOverlapsEligibleDay(eventStart, eventEnd, eligibleDays)) return;
                                  const existing = userEventsMap.get(user.id);
                                  if (existing) {
                                    existing.events.push(event);
                                  } else {
                                    userEventsMap.set(user.id, { user, events: [event] });
                                  }
                                }
                              }
                            }
                          });

                        const groupedUsers = Array.from(userEventsMap.values());

                        // Sort by earliest event start date
                        groupedUsers.sort((a, b) => {
                          const aMin = Math.min(...a.events.map(e => new Date(e.start.dateTime).getTime()));
                          const bMin = Math.min(...b.events.map(e => new Date(e.start.dateTime).getTime()));
                          return aMin - bMin;
                        });

                        if (groupedUsers.length === 0) {
                          return (
                            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                              <Calendar className="w-12 h-12 mb-2 opacity-50" />
                              <p className="text-sm">{t('noAbsenceForPeriod')}</p>
                            </div>
                          );
                        }

                        const dateFormat = { day: 'numeric', month: 'short', year: 'numeric' } as const;

                        return groupedUsers.map(({ user, events }) => {
                          // Sort events by start date
                          const sorted = [...events].sort((a, b) =>
                            new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime()
                          );

                          // Helper: format HH:MM
                          const fmtTime = (d: Date): string =>
                            `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                          const fmtDate = (d: Date): string => d.toLocaleDateString(locale, dateFormat);
                          const fmtDateShort = (d: Date): string =>
                            d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });

                          // Classify each event: full-day range, or partial-day with hours
                          type Entry = {
                            isAllDay: boolean;
                            start: Date;
                            end: Date;
                            timeKey?: string; // "HH:MM-HH:MM" for grouping recurring partial OOF
                            reason: string;
                            isTrue: boolean; // true absence (vacation/sick) vs short meeting/busy
                          };
                          const entries: Entry[] = sorted.map(evt => {
                            const evtStart = new Date(evt.start.dateTime);
                            const evtEnd = evt.isAllDay
                              ? new Date(new Date(evt.end.dateTime).getTime() - 1000)
                              : new Date(evt.end.dateTime);
                            const reason = evt.showAs === 'oof' ? t('reasonOutOfOffice') : (evt.subject || t('absence'));
                            const timeKey = !evt.isAllDay
                              ? `${fmtTime(evtStart)}-${fmtTime(evtEnd)}`
                              : undefined;
                            return { isAllDay: evt.isAllDay, start: evtStart, end: evtEnd, timeKey, reason, isTrue: isTrueOOF(evt) };
                          });

                          // Merge full-day contiguous ranges (adjacent within 1 day)
                          const fullDayEntries = entries.filter(e => e.isAllDay);
                          const fullDayRanges: Array<{ start: Date; end: Date; isTrue: boolean }> = [];
                          for (const e of fullDayEntries) {
                            const last = fullDayRanges[fullDayRanges.length - 1];
                            if (last && e.start.getTime() <= last.end.getTime() + 86400000 && last.isTrue === e.isTrue) {
                              if (e.end > last.end) last.end = e.end;
                            } else {
                              fullDayRanges.push({ start: e.start, end: e.end, isTrue: e.isTrue });
                            }
                          }

                          // Group partial-day entries by timeKey → each group = list of dates
                          const partialGroups = new Map<string, { start: string; end: string; dates: Date[]; isTrue: boolean }>();
                          entries.filter(e => !e.isAllDay).forEach(e => {
                            const key = `${e.timeKey!}|${e.isTrue}`;
                            const existing = partialGroups.get(key);
                            if (existing) {
                              existing.dates.push(e.start);
                            } else {
                              partialGroups.set(key, {
                                start: fmtTime(e.start),
                                end: fmtTime(e.end),
                                isTrue: e.isTrue,
                                dates: [e.start],
                              });
                            }
                          });

                          // Collect unique reasons
                          const allReasons = new Set(entries.map(e => e.reason));
                          const reasonText = Array.from(allReasons).join(', ');

                          const chipClsTrue = "inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 rounded text-[11px] font-medium text-violet-700 whitespace-nowrap";
                          const chipClsBusy = "inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-[11px] font-medium text-slate-600 whitespace-nowrap";

                          return (
                            <div key={user.id} className="flex items-start gap-2 p-2 bg-gradient-to-r from-violet-50 to-purple-50 rounded-md">
                              <Avatar className="w-7 h-7 flex-shrink-0 mt-0.5">
                                <AvatarFallback className="text-[10px] bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                                  {user.firstName?.[0]}{user.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                <div className="flex items-baseline gap-1.5 flex-wrap">
                                  <p className="text-xs font-semibold text-slate-800">{user.firstName} {user.lastName}</p>
                                  <span className="text-[10px] text-slate-500 truncate">{reasonText}</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {fullDayRanges.map((r, idx) => {
                                    const isSingle = r.start.toDateString() === r.end.toDateString();
                                    return (
                                      <span key={`fd-${idx}`} className={r.isTrue ? chipClsTrue : chipClsBusy}>
                                        <Calendar className="w-3 h-3" />
                                        {isSingle ? fmtDate(r.start) : `${fmtDate(r.start)} → ${fmtDate(r.end)}`}
                                      </span>
                                    );
                                  })}
                                  {Array.from(partialGroups.values()).map((g, idx) => (
                                    <span key={`p-${idx}`} className={g.isTrue ? chipClsTrue : chipClsBusy}>
                                      <Clock className="w-3 h-3" />
                                      {g.start}-{g.end}
                                      <span className={g.isTrue ? "text-violet-500 font-normal" : "text-slate-500 font-normal"}>
                                        · {g.dates.map(d => fmtDateShort(d)).join(', ')}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </CardContent>
                </Card>
              )})())}
            </div>
          </div>
        </div>

        {/* Split a preview row into time segments (nothing sent yet) */}
        <Dialog open={!!splittingPreview} onOpenChange={(open) => { if (!open) setSplittingPreview(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Scissors className="w-5 h-5 text-amber-600" />
                {t('splitTitle')}
              </DialogTitle>
            </DialogHeader>

            {splittingPreview && (() => {
              const shiftStart = (splittingPreview.shift?.startTime || '').slice(0, 5);
              const shiftEnd = (splittingPreview.shift?.endTime || '').slice(0, 5);
              const eligible = getEligibleUsersForShift(splittingPreview.shift);
              const covers =
                previewSegments.length > 0 &&
                previewSegments[0].start === shiftStart &&
                previewSegments[previewSegments.length - 1].end === shiftEnd;
              const longEnough = previewSegments.every(s => toMin(s.end) - toMin(s.start) >= 30);
              const allAssigned = previewSegments.every(s => !!s.userId);

              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: splittingPreview.shift?.color || '#6b7280' }}
                    />
                    <span className="font-medium text-slate-800">{splittingPreview.shift?.name}</span>
                    <span className="text-slate-400">·</span>
                    <span>{shiftStart} → {shiftEnd}</span>
                  </div>

                  <div className="space-y-2">
                    {previewSegments.map((seg, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 hover:border-amber-200 hover:bg-amber-50/40 transition-colors"
                      >
                        <span className="w-6 h-6 flex items-center justify-center text-xs font-semibold text-amber-700 bg-amber-100 rounded-full flex-shrink-0">
                          {i + 1}
                        </span>
                        <Input
                          type="time"
                          value={seg.start}
                          disabled={i === 0}
                          onChange={(e) => updatePreviewSegment(i, { start: e.target.value })}
                          className="h-8 w-[92px] px-2 flex-shrink-0 tabular-nums disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                        <span className="text-slate-400 flex-shrink-0 text-sm">→</span>
                        <Input
                          type="time"
                          value={seg.end}
                          disabled={i === previewSegments.length - 1}
                          onChange={(e) => updatePreviewSegment(i, { end: e.target.value })}
                          className="h-8 w-[92px] px-2 flex-shrink-0 tabular-nums disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                        <Select value={seg.userId} onValueChange={(v) => updatePreviewSegment(i, { userId: v })}>
                          {/* min-w-0 lets the trigger shrink instead of pushing the row past the dialog */}
                          <SelectTrigger className="h-8 flex-1 min-w-0 hover:bg-white transition-colors">
                            <SelectValue placeholder={t('splitAssignedTo')} />
                          </SelectTrigger>
                          <SelectContent>
                            {eligible.map((u: any) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.firstName} {u.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {previewSegments.length > 2 ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            onClick={() => removePreviewSegment(i)}
                            title={t('splitRemoveSegment')}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        ) : (
                          // Keep the columns aligned when no remove button shows.
                          <span className="w-8 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>

                  {previewSegments.length < 6 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addPreviewSegment}
                      className="hover:bg-amber-50/60 hover:text-amber-700 hover:border-amber-200 transition-colors"
                    >
                      + {t('splitAddSegment')}
                    </Button>
                  )}

                  {!covers && (
                    <p className="text-xs text-red-600 bg-red-50 border-l-2 border-red-300 px-2 py-1.5 rounded">
                      {t('splitCoverageError')}
                    </p>
                  )}
                  {covers && !longEnough && (
                    <p className="text-xs text-red-600 bg-red-50 border-l-2 border-red-300 px-2 py-1.5 rounded">
                      {t('splitMinDuration')}
                    </p>
                  )}

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setSplittingPreview(null)}
                      className="hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors"
                    >
                      {tCommon('cancel')}
                    </Button>
                    <Button
                      onClick={applyPreviewSplit}
                      disabled={!covers || !longEnough || !allAssigned}
                      className="bg-primary hover:bg-primary/90 transition-colors"
                    >
                      <Scissors className="w-4 h-4 mr-2" />
                      {t('splitSave')}
                    </Button>
                  </DialogFooter>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Improved day details dialog */}
        <Dialog
            open={isDetailDialogOpen}
            onOpenChange={(open) => {
              if (!open) {
                setEditingAssignment(null);
                setTempAssignedUser(null);
              }
              setIsDetailDialogOpen(open);
            }}
          >
          <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto [&>button]:hidden">
            <DialogHeader>
              <DialogTitle>
                {selectedDayAssignments && selectedDayAssignments[0] && (
                  <>
                    <div className="flex items-center justify-between">
                      <span>
                        {new Date(selectedDayAssignments[0].date).toLocaleDateString(locale, {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </span>
                      <Badge variant="outline">
                        {selectedDayAssignments.length} shift{selectedDayAssignments.length > 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
            {selectedDayAssignments && (
              <div className="space-y-4">
                {selectedDayAssignments
                  .sort((a, b) => {
                    const timeA = a.shift?.startTime || '00:00';
                    const timeB = b.shift?.startTime || '00:00';
                    return timeA.localeCompare(timeB);
                  })
                  .map((assignment, index) => {
                    // Use shift color from DB
                    const color = assignment.isPikett ? '#dc2626' : (assignment.shift?.color || '#6b7280');
                    
                    return (
                      <div key={`${assignment.shiftId}-${index}`} 
                          className="border rounded-lg p-4 transition-all hover:shadow-md" 
                           style={{ borderColor: color }}>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-lg flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                            {assignment.isPikett && (
                              <Shield className="w-5 h-5 text-red-600" />
                            )}
                            {assignment.shift?.name}
                            {assignment.isRotationAssignment && !assignment.isPikett && (
                              <Badge className="bg-orange-100 text-orange-700 text-xs">
                                <RotateCw className="w-3 h-3 mr-1" />
                                Rotation
                              </Badge>
                            )}
                          </h3>
                          <Badge variant="outline" style={{ borderColor: color, color }}>
                            {assignment.shift?.startTime} - {assignment.shift?.endTime}
                          </Badge>
                        </div>

                        {assignment.assignedUsers.length > 0 ? (
                          <div className="bg-green-50 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                {editingAssignment === `${assignment.date}-${index}` ? (
                                  <Select
                                    value={tempAssignedUser || assignment.assignedUsers[0]?.id}
                                    onValueChange={setTempAssignedUser}
                                  >
                                    <SelectTrigger className="w-auto min-w-64 hover:bg-secondary/20 transition-colors">
                                      {(() => {
                                        const selectedUserId = tempAssignedUser || assignment.assignedUsers[0]?.id;
                                        const selectedUser = availableUsers.find(u => u.id === selectedUserId);
                                        const constraint = assignment.unavailableUsers.find(u =>
                                          u.user.id === selectedUserId &&
                                          u.reason !== t('reasonAlreadyAssignedToday') &&
                                          u.reason !== t('alreadyAssignedToday')
                                        );

                                        if (!selectedUser) {
                                          return <SelectValue placeholder={t('selectUserToViewShifts')} />;
                                        }

                                        return (
                                          <div className="flex items-center gap-2">
                                            <span>{selectedUser.firstName} {selectedUser.lastName}</span>
                                            {constraint && (
                                              <Badge variant="outline" className="text-xs bg-red-50 border-red-200">
                                                {constraint.reason}
                                              </Badge>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[400px]">
                                      <SelectItem value="none">
                                        <span className="text-slate-400">{t('unassigned')}</span>
                                      </SelectItem>
                                      
                                      {/* Eligible users */}
                                      <div className="py-2">
                                        <p className="px-2 text-xs font-semibold text-slate-600 mb-1">{t('available')}</p>
                                        {(() => {
                                        // All shifts/piketts blocking this user today: current preview + DB rows
                                        // (a PENDING/ACCEPTED/TENTATIVE assignment already saved must also block).
                                        const getOtherShiftsForUser = (userId: string) => {
                                          const fromPreview = (selectedDayAssignments?.filter(a =>
                                            a.date === assignment.date &&
                                            a.assignedUsers.some(u => u.id === userId) &&
                                            a.shiftId !== assignment.shiftId
                                          ) || []).map(a => {
                                            const dbMatch = (a as any).isPikett
                                              ? dbPikettAssignments.find((db: any) => db.userId === userId && db.pikettId === a.shiftId && normalizeDbDate(db.date) === a.date)
                                              : dbAssignments.find((db: any) => db.userId === userId && db.shiftId === a.shiftId && normalizeDbDate(db.date) === a.date);
                                            return { ...a, _dbStatus: dbMatch?.status as string | undefined };
                                          }).filter(a => {
                                            // Ignore REFUSED / CANCELLED — the user is free again.
                                            const s = (a as any)._dbStatus;
                                            return !s || (s !== 'REFUSED' && s !== 'CANCELLED');
                                          });
                                          const previewShiftIds = new Set(fromPreview.map(a => a.shiftId));
                                          const activeStatuses = new Set(['PENDING', 'TENTATIVE', 'ACCEPTED']);
                                          const fromDbShifts = dbAssignments.filter((a: any) =>
                                            a.userId === userId &&
                                            a.shiftId !== assignment.shiftId &&
                                            normalizeDbDate(a.date) === assignment.date &&
                                            activeStatuses.has(a.status) &&
                                            !previewShiftIds.has(a.shiftId)
                                          ).map((a: any) => ({
                                            date: assignment.date,
                                            shiftId: a.shiftId,
                                            shift: a.shift,
                                            assignedUsers: [{ id: userId }],
                                            isPikett: false,
                                            _dbStatus: a.status,
                                          }));
                                          const fromDbPiketts = dbPikettAssignments.filter((a: any) =>
                                            a.userId === userId &&
                                            a.pikettId !== assignment.shiftId &&
                                            normalizeDbDate(a.date) === assignment.date &&
                                            activeStatuses.has(a.status) &&
                                            !previewShiftIds.has(a.pikettId)
                                          ).map((a: any) => ({
                                            date: assignment.date,
                                            shiftId: a.pikettId,
                                            shift: a.pikett,
                                            assignedUsers: [{ id: userId }],
                                            isPikett: true,
                                            _dbStatus: a.status,
                                          }));
                                          return [...fromPreview, ...fromDbShifts, ...fromDbPiketts];
                                        };
                                        
                                        // Eligible users for this shift/pikett — no `worksThisDay` filter here so that
                                        // users off that day can still be manually assigned; they will appear in the
                                        // "Constraints broken" list with a "Not working today" badge.
                                        const eligibleUsers = assignment.isPikett
                                          ? availableUsers.filter(u => {
                                              if (u.status !== 'ACTIVE' && u.status !== 'active') return false;
                                              const pikett = piketts.find(p => p.id === assignment.shiftId);
                                              if (!pikett) return false;
                                              const inTeam = u.teamId === pikett.teamId;
                                              const included = (pikett as any).includedUserIds?.includes(u.id);
                                              const excluded = (pikett as any).excludedUserIds?.includes(u.id);
                                              return (inTeam && !excluded) || included;
                                            })
                                          : availableUsers.filter(u => {
                                              if (u.status !== 'ACTIVE' && u.status !== 'active') return false;
                                              const shift = shifts.find(s => s.id === assignment.shiftId);
                                              if (!shift) return false;
                                              const inTeam = u.teamId === shift.teamId;
                                              const included = (shift as any).includedUserIds?.includes(u.id);
                                              const excluded = (shift as any).excludedUserIds?.includes(u.id);
                                              return (inTeam && !excluded) || included;
                                            });

                                        // Recalculate unavailableUsers in real time
                                        // For OOF, we need to recalculate with shift hours
                                        const shift = shifts.find(s => s.id === assignment.shiftId);
                                        const pikett = piketts.find(p => p.id === assignment.shiftId);
                                        const currentShift = shift || pikett;

                                        // Adjacent = previous/next WORKING day of THIS shift (Friday↔Monday).
                                        const [ay, am, ad] = String(assignment.date).split('-').map(Number);
                                        const assignmentDate = new Date(ay, (am || 1) - 1, ad || 1, 12);
                                        const localDateStr = (d: Date) =>
                                          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                        const shiftForAdj = assignment.isPikett
                                          ? piketts.find(p => p.id === assignment.shiftId)
                                          : shifts.find(s => s.id === assignment.shiftId);
                                        const allowedDows: number[] | null = (shiftForAdj as any)?.daysOfWeek || null;
                                        const isWorkDay = (d: Date) => !allowedDows || allowedDows.includes(d.getDay());
                                        const walk = (dir: 1 | -1): string | undefined => {
                                          const d = new Date(assignmentDate);
                                          for (let i = 0; i < 7; i++) {
                                            d.setDate(d.getDate() + dir);
                                            if (isWorkDay(d)) return localDateStr(d);
                                          }
                                          return undefined;
                                        };
                                        const prevDateStr = walk(-1) || '';
                                        const nextDateStr = walk(1) || '';

                                        // Categorize each eligible user (accumulate ALL reasons per user rather than the first)
                                        const usersWithOtherShifts: any[] = [];
                                        const usersWithOOF: Array<{user: any; reason: string; conflictEvents: OutlookEvent[]}> = [];
                                        const usersWithConsecutiveShifts: Array<{user: any; reason: string; conflictEvents: OutlookEvent[]}> = [];
                                        const usersNotWorkingToday: Array<{user: any; reason: string; conflictEvents: OutlookEvent[]}> = [];
                                        const available: any[] = [];
                                        // Collect ALL reasons per user so the badge shows the full picture
                                        const userExtraReasons = new Map<string, string[]>();
                                        const addReason = (uid: string, reason: string) => {
                                          if (!userExtraReasons.has(uid)) userExtraReasons.set(uid, []);
                                          userExtraReasons.get(uid)!.push(reason);
                                        };

                                        for (const user of eligibleUsers) {
                                          // Do not process the currently assigned user
                                          if (assignment.assignedUsers.length > 0 &&
                                              assignment.assignedUsers[0].id === user.id) {
                                            continue;
                                          }

                                          // 1. Check if already assigned to another shift today
                                          const otherShifts = getOtherShiftsForUser(user.id);
                                          if (otherShifts.length > 0) {
                                            usersWithOtherShifts.push(user);
                                            continue; // Do not double-list this user under other constraint categories
                                          }

                                          // 2. Check Out of Office
                                          let partialOOFEvents: OutlookEvent[] | null = null;
                                          let hasFullOOF = false;
                                          if (currentShift) {
                                            const availability = isUserAvailable(user, assignment.date, outOfOfficeEvents, currentShift);
                                            if (!availability.available) {
                                              if (availability.coversFullShift) {
                                                hasFullOOF = true;
                                                addReason(user.id, t('reasonOutOfOffice'));
                                                if (!usersWithOOF.find(u => u.user.id === user.id)) {
                                                  usersWithOOF.push({
                                                    user,
                                                    reason: t('reasonOutOfOffice'),
                                                    conflictEvents: availability.conflictEvents || []
                                                  });
                                                }
                                              } else {
                                                partialOOFEvents = availability.conflictEvents || [];
                                              }
                                            }
                                          }

                                          // 3. Check if not working this day
                                          const worksThisDay = isUserWorkingOnDay(user, assignment.date, shift?.startTime, shift?.endTime);
                                          let notWorkingToday = false;
                                          if (!worksThisDay) {
                                            const isJoker = (user.workPercent ?? 100) === 0;
                                            const r = isJoker ? t('joker') : t('reasonNotWorkingToday');
                                            addReason(user.id, r);
                                            notWorkingToday = true;
                                            if (!hasFullOOF && !usersNotWorkingToday.find(u => u.user.id === user.id)) {
                                              usersNotWorkingToday.push({
                                                user,
                                                reason: r,
                                                conflictEvents: []
                                              });
                                            }
                                          }

                                          // 3.5 Check "on pikett this week" and "rest-weeks law"
                                          //     (matches PRIORITY 2.7 of auto-assign; also warns for pikett↔pikett same-week
                                          //     and cross-pikett rest-week violations — the user is still selectable)
                                          const isoWk = (d: string) => {
                                            const [y, m, dd] = d.split('-').map(Number);
                                            const tmp = new Date(Date.UTC(y, (m || 1) - 1, dd || 1));
                                            const dn = tmp.getUTCDay() || 7;
                                            tmp.setUTCDate(tmp.getUTCDate() + 4 - dn);
                                            const ys = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
                                            const wn = Math.ceil((((tmp.getTime() - ys.getTime()) / 86400000) + 1) / 7);
                                            return `${tmp.getUTCFullYear()}-W${String(wn).padStart(2, '0')}`;
                                          };
                                          const currentWk = isoWk(assignment.date);
                                          let onPikettThisWeek = false;
                                          let conflictingPikettName: string | null = null;
                                          let restWeeksViolated = false;
                                          if (assignment.isPikett) {
                                            // Manual pikett assignment: warn but do not block.
                                            //  a) User is already on ANOTHER pikett this same week
                                            const conflictAssignment = tempShiftAssignments.find(a =>
                                              a.isPikett &&
                                              a.shiftId !== assignment.shiftId &&
                                              isoWk(a.date) === currentWk &&
                                              a.assignedUsers.some((u: any) => u.id === user.id)
                                            );
                                            onPikettThisWeek = !!conflictAssignment;
                                            if (conflictAssignment) {
                                              const cp = piketts.find(p => p.id === conflictAssignment.shiftId);
                                              conflictingPikettName = cp?.name || null;
                                            }
                                            //  b) Rest-weeks law (default 3): user did any pikett too recently
                                            const currentPikett = piketts.find(p => p.id === assignment.shiftId) as any;
                                            const minRest = currentPikett?.minRestWeeks ?? 3;
                                            const currentWkIdx = ((): number => {
                                              const [y, w] = currentWk.split('-W').map(Number);
                                              return y * 53 + w;
                                            })();
                                            const otherPikettWeeks = tempShiftAssignments
                                              .filter(a => a.isPikett && isoWk(a.date) !== currentWk && a.assignedUsers.some((u: any) => u.id === user.id))
                                              .map(a => {
                                                const wk = isoWk(a.date);
                                                const [y, w] = wk.split('-W').map(Number);
                                                return y * 53 + w;
                                              });
                                            restWeeksViolated = otherPikettWeeks.some(wk => Math.abs(currentWkIdx - wk) <= minRest);
                                          } else {
                                            const conflictAssignment = tempShiftAssignments.find(a =>
                                              a.isPikett &&
                                              isoWk(a.date) === currentWk &&
                                              a.assignedUsers.some((u: any) => u.id === user.id)
                                            );
                                            onPikettThisWeek = !!conflictAssignment;
                                            if (conflictAssignment) {
                                              const cp = piketts.find(p => p.id === conflictAssignment.shiftId);
                                              conflictingPikettName = cp?.name || null;
                                            }
                                          }
                                          if (restWeeksViolated) {
                                            addReason(user.id, t('reasonRestWeeksViolated'));
                                            if (!hasFullOOF && !notWorkingToday) {
                                              if (!usersWithConsecutiveShifts.find(u => u.user.id === user.id)) {
                                                usersWithConsecutiveShifts.push({
                                                  user,
                                                  reason: t('reasonRestWeeksViolated'),
                                                  conflictEvents: []
                                                });
                                              }
                                            }
                                          }
                                          if (onPikettThisWeek) {
                                            const pikettReason = conflictingPikettName
                                              ? t('reasonPikettSameWeekNamed', { pikett: conflictingPikettName })
                                              : t('reasonPikettSameWeek');
                                            addReason(user.id, pikettReason);
                                            if (!hasFullOOF && !notWorkingToday) {
                                              if (!usersWithConsecutiveShifts.find(u => u.user.id === user.id)) {
                                                usersWithConsecutiveShifts.push({
                                                  user,
                                                  reason: pikettReason,
                                                  conflictEvents: []
                                                });
                                              }
                                            }
                                          }

                                          // 4. Check consecutive shifts
                                          const hasConsecutiveShift = tempShiftAssignments.some(a => {
                                            return (a.date === prevDateStr || a.date === nextDateStr) &&
                                                  a.assignedUsers.some(u => u.id === user.id);
                                          });

                                          if (hasConsecutiveShift) {
                                            addReason(user.id, t('reasonConsecutiveShifts'));
                                            if (!hasFullOOF && !notWorkingToday && !usersWithConsecutiveShifts.find(u => u.user.id === user.id)) {
                                              usersWithConsecutiveShifts.push({
                                                user,
                                                reason: t('reasonConsecutiveShifts'),
                                                conflictEvents: []
                                              });
                                            }
                                          }

                                          // 5. Check MAX_LOAD user rule — annual (DB + preview).
                                          let hasMaxLoadHit = false;
                                          const maxLoadRules = (user.rules || []).filter(
                                            (r: any) => r.type === 'MAX_LOAD' && r.enabled && r.config.shiftId === assignment.shiftId
                                          );
                                          if (maxLoadRules.length > 0) {
                                            const rule = maxLoadRules[0];
                                            const pct = rule.config.maxPercentage;
                                            const activeStatuses = new Set(['PENDING', 'TENTATIVE', 'ACCEPTED']);
                                            const [ay] = String(assignment.date).split('-').map(Number);
                                            // Piketts live in their own table and cover every day of the week.
                                            const isPikettRule = !!assignment.isPikett;
                                            const dbRows: any[] = isPikettRule ? dbPikettAssignments : dbAssignments;
                                            const idField = isPikettRule ? 'pikettId' : 'shiftId';
                                            const dbCount = dbRows.filter((a: any) =>
                                              a.userId === user.id &&
                                              a[idField] === assignment.shiftId &&
                                              activeStatuses.has(a.status) &&
                                              new Date(a.date).getFullYear() === ay
                                            ).length;
                                            // Preview rows (avoid double-counting: skip if already covered by DB)
                                            const dbKeys = new Set(dbRows
                                              .filter((a: any) => a.userId === user.id && a[idField] === assignment.shiftId && activeStatuses.has(a.status))
                                              .map((a: any) => normalizeDbDate(a.date)));
                                            const previewCount = tempShiftAssignments.filter(a =>
                                              a.shiftId === assignment.shiftId &&
                                              a.date !== assignment.date &&
                                              a.assignedUsers.some((u: any) => u.id === user.id) &&
                                              !dbKeys.has(a.date)
                                            ).length;
                                            const currentCount = dbCount + previewCount;
                                            // Denominator = active days of this shift/pikett in the whole year
                                            const itemRef = isPikettRule
                                              ? piketts.find(p => p.id === assignment.shiftId)
                                              : shifts.find(s => s.id === assignment.shiftId);
                                            const allowedDows: number[] | null = (itemRef as any)?.daysOfWeek || null;
                                            const yearStart = new Date(ay, 0, 1);
                                            const yearEnd = new Date(ay, 11, 31);
                                            let activeCount = 0;
                                            for (let d = new Date(yearStart); d.getTime() <= yearEnd.getTime(); d.setDate(d.getDate() + 1)) {
                                              if (!allowedDows || allowedDows.includes(d.getDay())) activeCount++;
                                            }
                                            const maxAllowed = Math.max(1, Math.ceil(activeCount * (pct / 100)));
                                            if (currentCount >= maxAllowed) {
                                              hasMaxLoadHit = true;
                                              const reasonLabel = t('reasonMaxLoad', { pct });
                                              addReason(user.id, reasonLabel);
                                              if (!hasFullOOF && !notWorkingToday && !hasConsecutiveShift) {
                                                if (!usersWithConsecutiveShifts.find(u => u.user.id === user.id)) {
                                                  usersWithConsecutiveShifts.push({
                                                    user,
                                                    reason: reasonLabel,
                                                    conflictEvents: []
                                                  });
                                                }
                                              }
                                            }
                                          }

                                          // Warn if this user already refused ANY shift/pikett on this date —
                                          // a refusal may signal an unplanned issue that day. Admin stays free
                                          // to assign, but must see the history.
                                          const refusedShiftNames: string[] = [];
                                          for (const a of dbAssignments as any[]) {
                                            if (a.userId === user.id && normalizeDbDate(a.date) === assignment.date && a.status === 'REFUSED') {
                                              const n = a.shift?.name || shifts.find(s => s.id === a.shiftId)?.name;
                                              if (n && !refusedShiftNames.includes(n)) refusedShiftNames.push(n);
                                            }
                                          }
                                          for (const a of dbPikettAssignments as any[]) {
                                            if (a.userId === user.id && normalizeDbDate(a.date) === assignment.date && a.status === 'REFUSED') {
                                              const n = a.pikett?.name || piketts.find(p => p.id === a.pikettId)?.name;
                                              if (n && !refusedShiftNames.includes(n)) refusedShiftNames.push(n);
                                            }
                                          }

                                          // 6. If no constraint at all, user is truly available
                                          if (!hasFullOOF && !notWorkingToday && !hasConsecutiveShift && !hasMaxLoadHit && !onPikettThisWeek && !restWeeksViolated && otherShifts.length === 0) {
                                            available.push({ user, partialOOF: partialOOFEvents, refusedShiftNames });
                                          }
                                        }

                                        // Combine all constraints for display
                                        const currentlyUnavailable = [
                                          ...usersWithOOF,
                                          ...usersWithConsecutiveShifts,
                                          ...usersNotWorkingToday
                                        ];

                                        return (
                                          <>
                                            {/* Available users */}
                                            {available.map(({ user, partialOOF, refusedShiftNames }: any) => {
                                              const fmtHM = (d: Date) =>
                                                `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                                              const partialEvents = (partialOOF || []) as OutlookEvent[];
                                              const partialOOFOnly = partialEvents.filter(e => isTrueOOF(e));
                                              const oofText = partialOOFOnly.length > 0
                                                ? partialOOFOnly.map(e => {
                                                    const s = new Date(e.start.dateTime);
                                                    const en = e.isAllDay
                                                      ? new Date(new Date(e.end.dateTime).getTime() - 1000)
                                                      : new Date(e.end.dateTime);
                                                    return `${fmtHM(s)}-${fmtHM(en)}`;
                                                  }).join(', ')
                                                : null;
                                              return (
                                                <SelectItem key={user.id} value={user.id} className="min-w-max">
                                                  <div className="flex items-center justify-between gap-3 w-full min-w-[280px]">
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                      <Avatar className="w-6 h-6 flex-shrink-0">
                                                        <AvatarFallback className="text-xs">
                                                          {user.firstName?.[0]}{user.lastName?.[0]}
                                                        </AvatarFallback>
                                                      </Avatar>
                                                      <span>{user.firstName} {user.lastName}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                                                      {(refusedShiftNames as string[])?.map((name, i) => (
                                                        <Badge key={`ref-${i}`} variant="outline" className="text-xs bg-red-50 border-red-200 text-red-700 whitespace-nowrap">
                                                          ⛔ {t('refusedShiftToday', { shift: name })}
                                                        </Badge>
                                                      ))}
                                                      {oofText && (
                                                        <Badge variant="outline" className="text-xs bg-yellow-50 border-yellow-300 text-yellow-800 whitespace-nowrap">
                                                          {t('reasonOutOfOffice')} {oofText}
                                                        </Badge>
                                                      )}
                                                    </div>
                                                  </div>
                                                </SelectItem>
                                              );
                                            })}
                                            
                                            {/* Users already assigned to another shift today */}
                                            {usersWithOtherShifts.length > 0 && (
                                              <>
                                                <div className="px-2 py-1 mt-2 border-t">
                                                  <p className="text-xs font-semibold text-orange-600">
                                                    ⚠️ {t('alreadyAssignedToday')}
                                                  </p>
                                                </div>
                                                {usersWithOtherShifts.map(user => {
                                                  const otherShifts = getOtherShiftsForUser(user.id);
                                                  return (
                                                    <SelectItem key={`busy-${user.id}`} value={user.id} className="min-w-max">
                                                      <div className="flex items-center justify-between gap-3 w-full min-w-[400px]">
                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                          <Avatar className="w-6 h-6 flex-shrink-0">
                                                            <AvatarFallback className="text-xs">
                                                              {user.firstName?.[0]}{user.lastName?.[0]}
                                                            </AvatarFallback>
                                                          </Avatar>
                                                          <span className="whitespace-nowrap">{user.firstName} {user.lastName}</span>
                                                        </div>
                                                        <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
                                                          {otherShifts.map((s: any, idx) => {
                                                            const status = s._dbStatus;
                                                            const isPending = status === 'PENDING' || status === 'TENTATIVE';
                                                            const cls = isPending
                                                              ? 'bg-blue-50 border-blue-200 text-blue-700'
                                                              : 'bg-orange-50 border-orange-200 text-orange-700';
                                                            const label = isPending
                                                              ? t('pendingOnShift', { shift: s.shift?.name || 'Shift' })
                                                              : (s.shift?.name || 'Shift');
                                                            return (
                                                              <Badge key={idx} variant="outline" className={`text-xs whitespace-nowrap ${cls}`}>
                                                                {label}
                                                              </Badge>
                                                            );
                                                          })}
                                                        </div>
                                                      </div>
                                                    </SelectItem>
                                                  );
                                                })}
                                              </>
                                            )}
                                            
                                            {/* Users with original constraints (OOF, etc.) */}
                                            {/* Users with original constraints (OOF, etc.) */}
                                            {currentlyUnavailable.length > 0 && (
                                              <>
                                                <div className="px-2 py-1 mt-2 border-t">
                                                  <p className="text-xs font-semibold text-orange-600">
                                                    ⚠️ {t('constraintsBroken')}
                                                  </p>
                                                </div>
                                                {currentlyUnavailable.map(item => {
                                                  // Show ALL accumulated reasons instead of only the first
                                                  const allReasons = userExtraReasons.get(item.user.id) || [item.reason];
                                                  const uniqueReasons = Array.from(new Set(allReasons));
                                                  return (
                                                    <SelectItem key={`unavailable-${item.user.id}`} value={item.user.id} className="min-w-max">
                                                      <div className="flex items-center justify-between gap-3 w-full min-w-[400px]">
                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                          <Avatar className="w-6 h-6 flex-shrink-0">
                                                            <AvatarFallback className="text-xs">
                                                              {item.user.firstName?.[0]}{item.user.lastName?.[0]}
                                                            </AvatarFallback>
                                                          </Avatar>
                                                          <span className="whitespace-nowrap">{item.user.firstName} {item.user.lastName}</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1 justify-end">
                                                          {uniqueReasons.map((r, i) => (
                                                            <Badge key={i} variant="outline" className="text-xs bg-red-50 border-red-200 whitespace-nowrap">
                                                              {r}
                                                            </Badge>
                                                          ))}
                                                        </div>
                                                      </div>
                                                    </SelectItem>
                                                  );
                                                })}
                                              </>
                                            )}
                                          </>
                                        );
                                      })()}
                                      </div>                                        
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <>
                                    <Avatar className="w-10 h-10 flex-shrink-0">
                                            <AvatarFallback className="text-sm bg-gradient-to-br from-green-500 to-green-600 text-white font-medium">
                                              {assignment.assignedUsers[0].firstName?.[0]}
                                              {assignment.assignedUsers[0].lastName?.[0]}
                                            </AvatarFallback>
                                          </Avatar>
                                          <div className="flex-1 space-y-1">
                                            <p className="font-semibold text-base text-slate-900">
                                              {assignment.assignedUsers[0].firstName} {assignment.assignedUsers[0].lastName}
                                            </p>
                                            <p className="text-sm text-slate-500">
                                              {assignment.assignedUsers[0].email}
                                            </p>
                                            {assignment.isManualOverride && (
                                              <Badge className="text-xs mt-2 bg-orange-100 text-orange-700 border-0 inline-flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" />
                                                {t('assignedManually')} ({assignment.overrideReason})
                                              </Badge>
                                            )}
                                            {(() => {
                                              const status = getDateShiftStatus(assignment.date, assignment.shiftId, assignment.assignedUsers[0]?.id);
                                              const cfg: Record<string, { bg: string; icon: React.ReactNode; label: string }> = {
                                                PENDING: { bg: 'bg-blue-100 text-blue-700', icon: <Clock className="w-3 h-3" />, label: t('statusNoAnswer') },
                                                TENTATIVE: { bg: 'bg-orange-100 text-orange-700', icon: <AlertCircle className="w-3 h-3" />, label: t('statusTentative') },
                                                ACCEPTED: { bg: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" />, label: t('statusAccepted') },
                                                REFUSED: { bg: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" />, label: t('statusRefused') },
                                                CANCELLED: { bg: 'bg-gray-100 text-gray-600', icon: <XCircle className="w-3 h-3" />, label: t('statusCancelled') },
                                              };
                                              const c = status && cfg[status];
                                              return c ? (
                                                <Badge className={`text-xs mt-2 ${c.bg} border-0 inline-flex items-center gap-1`}>{c.icon}{c.label}</Badge>
                                              ) : (
                                                <Badge variant="outline" className="text-xs mt-2 bg-slate-50 text-slate-500 inline-flex items-center gap-1"><Send className="w-3 h-3" />{t('statusNotSent')}</Badge>
                                              );
                                            })()}
                                          </div>
                                        </>
                                      )}
                                    </div>

                              <div className="flex items-center gap-2">
                                {assignment.isRotationAssignment && !editingAssignment && (
                                  <Badge className="text-xs border-0 bg-orange-100 text-orange-700">
                                    <RotateCw className="w-3 h-3 mr-1" />
                                    {t('rotation')}
                                  </Badge>
                                )}
                                
                                {editingAssignment === `${assignment.date}-${index}` ? (
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        handleSaveAssignmentChange(assignment.date, assignment.shiftId);
                                      }}
                                      className="hover:bg-orange-600/10 hover:text-orange-600 hover:border-orange-600 transition-colors"
                                    >
                                      <Save className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setEditingAssignment(null);
                                        setTempAssignedUser(null);
                                      }}
                                      className="bg-red-600 hover:bg-red-700 text-white transition-colors"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEditingAssignment(`${assignment.date}-${index}`);
                                        setTempAssignedUser(assignment.assignedUsers[0]?.id || null);
                                      }}
                                      className="hover:bg-secondary/20 transition-colors"
                                    >
                                      <Edit className="w-3 h-3 mr-1" />
                                      {tCommon("edit")}
                                    </Button>
                                    {!assignment.isPikett && (
                                      assignment.segmentGroupId ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => undoPreviewSplit(assignment.segmentGroupId!)}
                                          title={t('splitRemove')}
                                          className="hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300"
                                        >
                                          <Scissors className="w-3 h-3" />
                                        </Button>
                                      ) : (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => openPreviewSplit(assignment)}
                                          title={t('splitShift')}
                                          className="hover:bg-green-50 hover:text-green-700 hover:border-green-300"
                                        >
                                          <Scissors className="w-3 h-3" />
                                        </Button>
                                      )
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : editingAssignment === `${assignment.date}-${index}` ? (
                          <div className="bg-orange-50 rounded-lg p-3">
                            <div className="flex items-center gap-4">
                              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                              <Select
                                value={tempAssignedUser || undefined}
                                onValueChange={setTempAssignedUser}
                              >
                                <SelectTrigger className="w-auto min-w-64 hover:bg-secondary/20 transition-colors">
                                  <SelectValue placeholder={t('selectUserToViewShifts')} />
                                </SelectTrigger>
                                <SelectContent className="max-h-[400px]">
                                  <SelectItem value="none">
                                    <span className="text-slate-400">{t('unassigned')}</span>
                                  </SelectItem>
                                  {(() => {
                                    // Eligible members of this shift/pikett (ignoring constraints)
                                    const item = assignment.isPikett
                                      ? piketts.find(p => p.id === assignment.shiftId)
                                      : shifts.find(s => s.id === assignment.shiftId);
                                    if (!item) return null;
                                    const eligibleMembers = availableUsers.filter(u => {
                                      if (u.status !== 'ACTIVE' && u.status !== 'active') return false;
                                      const inTeam = u.teamId === (item as any).teamId;
                                      const included = (item as any).includedUserIds?.includes(u.id);
                                      const excluded = (item as any).excludedUserIds?.includes(u.id);
                                      return (inTeam && !excluded) || included;
                                    });
                                    return (
                                      <div className="py-2">
                                        <p className="px-2 text-xs font-semibold text-orange-700 mb-1">
                                          ⚠️ {t('constraintsBroken')}
                                        </p>
                                        {eligibleMembers.map(user => {
                                          const constraint = assignment.unavailableUsers.find(u => u.user.id === user.id);
                                          return (
                                            <SelectItem key={user.id} value={user.id} className="min-w-max">
                                              <div className="flex items-center justify-between gap-3 w-full min-w-[400px]">
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                  <Avatar className="w-6 h-6 flex-shrink-0">
                                                    <AvatarFallback className="text-xs">
                                                      {user.firstName?.[0]}{user.lastName?.[0]}
                                                    </AvatarFallback>
                                                  </Avatar>
                                                  <span className="whitespace-nowrap">{user.firstName} {user.lastName}</span>
                                                </div>
                                                {constraint && (
                                                  <Badge variant="outline" className="text-xs bg-red-50 border-red-200 flex-shrink-0 whitespace-nowrap">
                                                    {constraint.reason}
                                                  </Badge>
                                                )}
                                              </div>
                                            </SelectItem>
                                          );
                                        })}
                                      </div>
                                    );
                                  })()}
                                </SelectContent>
                              </Select>
                              <Button
                                onClick={() => handleSaveAssignmentChange(assignment.date, assignment.shiftId)}
                                variant="outline"
                                size="sm"
                                className="hover:bg-green-50"
                              >
                                <Save className="w-3 h-3 mr-1" />
                                {tCommon('save')}
                              </Button>
                              <Button
                                onClick={() => { setEditingAssignment(null); setTempAssignedUser(null); }}
                                variant="ghost"
                                size="sm"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                        <Alert className="border-orange-200 bg-orange-50">
                          <AlertCircle className="h-4 w-4 text-orange-600" />
                          <AlertDescription className="text-orange-800 flex items-center justify-between gap-3">
                            <span>{assignment.noAssignmentReason || t('noPersonAvailableForShift')}</span>
                            <Button
                              onClick={() => { setEditingAssignment(`${assignment.date}-${index}`); setTempAssignedUser(null); }}
                              variant="outline"
                              size="sm"
                              className="hover:bg-white flex-shrink-0"
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              {tCommon("edit")}
                            </Button>
                          </AlertDescription>
                        </Alert>
                      )}

                        {/* List of unavailable persons */}
                        {assignment.unavailableUsers.length > 0 && (
                          <details className="mt-3">
                            <summary className="text-sm text-slate-600 cursor-pointer hover:text-slate-800">
                              {assignment.unavailableUsers.length === 1
                                ? t('unavailablePersonSingular', { count: assignment.unavailableUsers.length })
                                : t('unavailablePersonPlural', { count: assignment.unavailableUsers.length })
                              }
                            </summary>
                            <div className="mt-2 space-y-1">
                              {assignment.unavailableUsers.map((item, idx) => (
                                <div key={idx} className="text-xs flex items-center justify-between p-2 bg-slate-50 rounded">
                                  <span className="font-medium">{item.user.firstName} {item.user.lastName}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {item.reason}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  })}
              </div>
          )}
          
          {/* Fixed action buttons at the bottom */}
          <div className="border-t bg-white px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-500">
                      {(() => {
                        if (!selectedDayAssignments || selectedDayAssignments.length === 0) return 0;
                        const selectedDate = selectedDayAssignments[0]?.date;

                        // Count manual modifications in tempShiftAssignments
                        const manualCount = tempShiftAssignments.filter(a =>
                          a.date === selectedDate && a.isManualOverride
                        ).length;

                        return manualCount === 1
                          ? t('manualModificationsSingular', { count: manualCount })
                          : t('manualModificationsPlural', { count: manualCount });
                      })()}
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        onClick={() => {
                          // Don't save anything, just close
                          setSelectedDayAssignments(null);
                          setTempShiftAssignments([...shiftAssignments]); // Restore original
                          setIsDetailDialogOpen(false);
                          setEditingAssignment(null);
                          setTempAssignedUser(null);
                        }}
                        className="min-w-[100px] hover:bg-secondary/20"
                      >
                        {tCommon("cancel")}
                      </Button>
                      <Button
                        onClick={() => {
                          // Apply modifications
                          setShiftAssignments(tempShiftAssignments);
                          setIsDetailDialogOpen(false);
                          setEditingAssignment(null);
                          setTempAssignedUser(null);
                        }}
                        className="bg-primary hover:bg-primary/90 min-w-[120px]"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {tCommon("validate")}
                      </Button>
                    </div>
                  </div>
                </div>
                </DialogContent>
              </Dialog>

        {/* Success dialog for sending invitations */}
        {/* Sending progress dialog */}
        <Dialog open={sendingInvitations} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-sm" showCloseButton={false}>
            <div className="flex flex-col items-center py-6 gap-4">
              {/* Progress ring */}
              {(() => {
                const r = 50, stroke = 6, size = 120;
                const circ = 2 * Math.PI * r;
                const pct = sendProgress.total > 0 ? sendProgress.current / sendProgress.total : 0;
                const offset = circ * (1 - pct);
                return (
                  <div className="relative" style={{ width: size, height: size }}>
                    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
                      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#22c55e" strokeWidth={stroke}
                        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dashoffset 0.3s ease' }} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-slate-800">{sendProgress.current}</span>
                      <span className="text-xs text-slate-500">/ {sendProgress.total}</span>
                    </div>
                  </div>
                );
              })()}
              <div className="text-center">
                <p className="font-semibold text-slate-800">{t('sendingInProgress')}</p>
                <p className="text-sm text-slate-500 mt-1">
                  <span className="text-green-600">{sendProgress.success} {t('sent')}</span>
                  {sendProgress.errors > 0 && (
                    <span className="text-red-500 ml-2">{sendProgress.errors} {t('errors')}</span>
                  )}
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-6 h-6" />
                {t('invitationsSentSuccess')}
              </DialogTitle>
            </DialogHeader>

            {successMessage && (
              <div className="space-y-4 py-4">
                {/* Sending statistics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <Mail className="w-5 h-5 text-green-600" />
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-2xl font-bold text-green-700">{successMessage.outlookSuccess}</p>
                    <p className="text-sm text-green-600">{t('invitationsSent', { count: successMessage.outlookSuccess })}</p>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      <CheckCircle className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-2xl font-bold text-blue-700">{successMessage.dbCount}</p>
                    <p className="text-sm text-blue-600">{t('assignmentsCreated', { count: successMessage.dbCount })}</p>
                  </div>
                </div>

                {/* Error message if present */}
                {successMessage.outlookErrors > 0 && (
                  <Alert className="border-orange-200 bg-orange-50">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800">
                      <p>{t('sendErrors', { count: successMessage.outlookErrors })}</p>
                      {successMessage.outlookErrorDetails && successMessage.outlookErrorDetails.length > 0 && (
                        <ul className="mt-2 text-xs space-y-1">
                          {successMessage.outlookErrorDetails.map((detail, i) => (
                            <li key={i} className="font-mono">{detail}</li>
                          ))}
                        </ul>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Information message */}
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-sm text-slate-600 flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{t('assignmentsVisibleInDashboard')}</span>
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setShowSuccessDialog(false);
                  setSuccessMessage(null);
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                {t('understood')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default function PlannerPageProtected() {
  return <ProtectedRoute><PlannerPage /></ProtectedRoute>;
}