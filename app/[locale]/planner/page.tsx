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
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRotationPatterns } from '@/contexts/RotationPatternsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
}

interface RotationPattern {
  id: string;
  name: string;
  description?: string;
  weeks: any[];
  cycleLength: number;
}

// Available colors for shifts (10 distinct colors)
const SHIFT_COLORS = [
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#10b981', // Green
  '#eab308', // Yellow
  '#8b5cf6', // Purple
  '#f97316', // Orange
  '#92400e', // Brown
  '#06b6d4', // Turquoise
  '#ec4899', // Pink
  '#6b7280', // Gray
];


const PlannerPage = () => {
  const t = useTranslations('planner');
  const tCommon = useTranslations('common');
  const locale = useLocale();

    const {
      piketts,
      loading: pikettsLoading
  } = usePiketts();

const { 
  holidays, 
  isUserOnHoliday,
  loading: holidaysLoading 
} = useHolidays();

// Holidays loaded in planner - no-op, data available via holidays state

  // State
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
  const [selectedPiketts, setSelectedPiketts] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isProcessingShifts, setIsProcessingShifts] = useState(false);
  const [outOfOfficeEvents, setOutOfOfficeEvents] = useState<OutlookEvent[]>([]);
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [selectedDayAssignments, setSelectedDayAssignments] = useState<ShiftAssignment[] | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
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

  // DB assignments state (for status badges)
  const [dbAssignments, setDbAssignments] = useState<any[]>([]);

  // Hooks
  const { shifts, loading: shiftsLoading } = useShifts();
  const { users, loading: usersLoading } = useUsers();
  const { teams, loading: teamsLoading } = useTeams();

  // Fetch existing DB assignments for status badges
  const fetchDbAssignments = async () => {
    try {
      const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
      const startDateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-01`;
      const endDateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      const response = await authFetch(`/api/shift-assignments?startDate=${startDateStr}&endDate=${endDateStr}`);
      if (response.ok) {
        const data = await response.json();
        setDbAssignments(data);
      }
    } catch (err) {
      // DB assignment fetch error - badges will not show
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

  // Get the status of a date+shift combination (checks if already sent)
  const getDateShiftStatus = (date: string, shiftId: string): 'PENDING' | 'TENTATIVE' | 'ACCEPTED' | 'REFUSED' | 'CANCELLED' | null => {
    const matches = dbAssignments.filter((a: any) => normalizeDbDate(a.date) === date && a.shiftId === shiftId);
    if (matches.length === 0) return null;
    if (matches.some((a: any) => a.status === 'ACCEPTED')) return 'ACCEPTED';
    if (matches.some((a: any) => a.status === 'REFUSED')) return 'REFUSED';
    if (matches.some((a: any) => a.status === 'TENTATIVE')) return 'TENTATIVE';
    if (matches.some((a: any) => a.status === 'CANCELLED')) return 'CANCELLED';
    return 'PENDING';
  };

  const defaultSettings = { avoidConsecutiveShifts: true, balanceShifts: true, checkCalendars: true, respectWorkPercentage: true, prioritySystem: true, enableRotations: true };
  const loadSettings = () => {
    if (typeof window === 'undefined') return defaultSettings;
    try { const s = localStorage.getItem('shiftSettings'); return s ? JSON.parse(s) : defaultSettings; } catch { return defaultSettings; }
  };

  // Utility function to check if a user works on a given day
const isUserWorkingOnDay = (user: any, date: string, shiftTime?: string, shiftEndTime?: string): boolean => {
  if (!user.availability) return true;
  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[dayOfWeek];
  
  const dayAvailability = user.availability[dayName];
  if (!dayAvailability) return true;
  
  // Check based on actual shift hours vs user availability
  // Boundary: 13:00 separates morning from afternoon
  // Logic: check where the MAJORITY of the shift falls
  if (shiftTime) {
    const [startH, startM] = shiftTime.split(':').map(Number);
    const startMinutes = startH * 60 + (startM || 0);
    const endMinutes = shiftEndTime
      ? parseInt(shiftEndTime.split(':')[0]) * 60 + (parseInt(shiftEndTime.split(':')[1]) || 0)
      : startMinutes;
    const midday = 13 * 60; // 13:00

    // Shift fully within morning (ends at or before 13:00)
    if (endMinutes <= midday) {
      return dayAvailability.morning === true;
    }
    // Shift fully within afternoon (starts at or after 13:00)
    if (startMinutes >= midday) {
      return dayAvailability.afternoon === true;
    }
    // Shift spans both morning and afternoon
    const morningPortion = midday - startMinutes;
    const afternoonPortion = endMinutes - midday;
    const totalDuration = endMinutes - startMinutes;
    const minorPortion = Math.min(morningPortion, afternoonPortion);

    // If the minor portion is small (< 25% of total), treat as single-period shift
    // e.g. 12:30-17:00 = 30min morning out of 270min total (11%) → afternoon shift
    // e.g. 08:00-14:00 = 60min afternoon out of 360min total (17%) → morning shift
    if (minorPortion / totalDuration < 0.25) {
      if (afternoonPortion > morningPortion) {
        return dayAvailability.afternoon === true;
      } else {
        return dayAvailability.morning === true;
      }
    }
    // Both portions are significant → needs both (e.g. 08:00-17:00)
    return dayAvailability.morning === true && dayAvailability.afternoon === true;
  }
  
  // If no time specified, check if at least part of the day is available
  return dayAvailability.morning === true || dayAvailability.afternoon === true;
};

  const [settings, setSettings] = useState(() => loadSettings());

  // Date validation
  const validateDates = (start: string, end: string): string => {
    if (!start || !end) {
      return '';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDateObj = new Date(start);
    const endDateObj = new Date(end);

    // Check that the start date is not after the end date
    if (startDateObj > endDateObj) {
      return t('startDateCannotBeAfterEnd');
    }

    // Check that dates are not in the past
    if (startDateObj < today) {
      return t('startDateCannotBeInPast');
    }

    if (endDateObj < today) {
      return t('endDateCannotBeInPast');
    }

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

    // Calculate which week of the cycle we are in
    // Use ISO week number for consistency across generation tranches
    // This ensures rotations continue correctly when generating in 3-4 month batches
    const currentDateObj = new Date(date);
    const tmp = new Date(currentDateObj.valueOf());
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const isoWeekNum = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

    // Determine the week in the cycle (0-based, using ISO week number)
    const weekInCycle = (isoWeekNum - 1) % pattern.cycleLength;

    const weekPattern = pattern.weeks[weekInCycle];
    if (!weekPattern) return null;

    // Get the day of the week
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][currentDateObj.getDay()];
    const shiftIds = weekPattern[dayOfWeek] || [];

    return shiftIds[0] || null;
  };

  // Shuffle function using mulberry32 PRNG (good distribution, deterministic per seed)
  const shuffleArray = <T,>(array: T[], seed: number, additionalSeed: string = ''): T[] => {
    const shuffled = [...array];
    let currentIndex = shuffled.length;

    // Hash string to number (djb2)
    const hashCode = (str: string): number => {
      let hash = 5381;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
      }
      return Math.abs(hash);
    };

    // Mulberry32 PRNG - fast, good distribution
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
    firstName: u.firstName, lastName: u.lastName, workPercent: u.workPercent || 100,
    status: u.status, rotationConfig: u.rotationConfig || null, teamId: u.teamId || null,
    availability: u.availability || null, role: u.role || null, location: u.location || null,
    rules: u.rules || []
  });

  const fetchUsersFromCalendars = async (): Promise<any[]> => {
    setIsLoadingUsers(true);
    try {
      const allUsers = users.map(mapDbUser);
      setAvailableUsers(allUsers);
      return allUsers;
    } catch {
      const allUsers = users.map(mapDbUser);
      setAvailableUsers(allUsers);
      return allUsers;
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleSaveAssignmentChange = (assignmentDate: string, assignmentShiftId: string) => {
  if (tempAssignedUser === null) return;
  
  const selectedUser = availableUsers.find(u => u.id === tempAssignedUser);
  if (!selectedUser) return;
  
  // Update in selectedDayAssignments (for dialog display)
  const updatedDayAssignments = selectedDayAssignments?.map(a => {
    if (a.date === assignmentDate && a.shiftId === assignmentShiftId) {
      // Find the original assignment in shiftAssignments
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

      // Check if it differs from the original assignment
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
        // Do not modify unavailableUsers - filtering is done at display time
        unavailableUsers: a.unavailableUsers
      };
    }
    return a;
  });

  // Update in tempShiftAssignments (for final save)
  // IMPORTANT: Also search piketts, not just regular shifts
  const updatedTempAssignments = tempShiftAssignments.map(a => {
    if (a.date === assignmentDate && a.shiftId === assignmentShiftId) {
      // Find the original assignment in shiftAssignments
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

      // Check if it differs from the original assignment
      const originalUserId = originalAssignment?.assignedUsers[0]?.id;
      const isChanged = originalUserId !== tempAssignedUser;

      // Keep all pikett properties if it's a pikett
      return {
        ...a,
        assignedUsers: selectedUser ? [selectedUser] : [],
        isManualOverride: isChanged || originalConstraint || hasOtherShift ? true : false,
        overrideReason: isChanged ? t('manualModification') :
                       originalConstraint ? originalConstraint.reason :
                       hasOtherShift ? t('alreadyAssignedToAnotherShift') :
                       undefined,
        // Do not modify unavailableUsers - filtering is done at display time
        unavailableUsers: a.unavailableUsers,
        // Preserve pikett-specific properties
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
        return [];
      }

      const allOutOfOfficeEvents: OutlookEvent[] = [];

      // Collect all eligible user emails
      const userEmails = availableUsers
        .filter(u => u.email)
        .map(u => u.email);

      if (userEmails.length === 0) return [];

      // Use Graph getSchedule API to check availability of all users at once
      // Process in batches of 20 (Graph API limit)
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
              dateTime: startDate + 'T00:00:00',
              timeZone: 'Europe/Zurich'
            },
            endTime: {
              dateTime: endDate + 'T23:59:59',
              timeZone: 'Europe/Zurich'
            },
            availabilityViewInterval: 1440 // 24h blocks (full day)
          })
        });

        if (!scheduleResponse.ok) {
          // getSchedule failed - fallback to own calendar method
          // Fallback: try the old method with /me/calendars
          return await fetchOutOfOfficeFromOwnCalendar();
        }

        const scheduleData = await scheduleResponse.json();

        for (const userSchedule of scheduleData.value) {
          const userEmail = userSchedule.scheduleId?.toLowerCase() || '';
          if (!userSchedule.scheduleItems) continue;

          for (const item of userSchedule.scheduleItems) {
            if (item.status === 'oof' || item.status === 'busy') {
              // getSchedule with availabilityViewInterval=1440 returns day-level items
              // End dates are exclusive (OOF until March 1 → end = March 2T00:00)
              // Subtract 1 day from end to get the real last day
              const endDt = new Date(item.end.dateTime);
              endDt.setDate(endDt.getDate() - 1);
              // Set end to 23:59:59 of the last real day
              const adjustedEnd = `${endDt.getFullYear()}-${String(endDt.getMonth() + 1).padStart(2, '0')}-${String(endDt.getDate()).padStart(2, '0')}T23:59:59`;

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

      return allOutOfOfficeEvents;
    } catch (error) {
      return [];
    }
  };

  // Fallback: read own calendars (old method)
  // Only returns OOF events that involve users from the selected teams
  const fetchOutOfOfficeFromOwnCalendar = async (): Promise<OutlookEvent[]> => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken || !startDate || !endDate) return [];

      // Build a set of eligible user emails (only shift members from selected teams)
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

              // Only keep events where the organizer or an attendee is a shift member
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
        } catch (error) {
          // Calendar fetch error - skip this calendar
        }
      }
      return allOutOfOfficeEvents;
    } catch (error) {
      return [];
    }
  };

  const generateDateRange = (start: string, end: string): string[] => {
    const dates: string[] = [];
    const startDateObj = new Date(start);
    const endDateObj = new Date(end);
    
    for (let d = new Date(startDateObj.getTime()); d <= endDateObj;) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12);
    }
    
    return dates;
  };

  const isUserAvailable = (user: any, date: string, oofEvents: OutlookEvent[], shift?: any) => {
  const userEmail = user.email.toLowerCase();

  // If a shift is provided with times, check the exact hours
  // Otherwise, check the whole day (00:00-23:59)
  let dateStart: Date;
  let dateEnd: Date;

  if (shift?.startTime && shift?.endTime) {
    // Normalize the time format (remove seconds if present)
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

    // Check if the user is involved in this event
    const isUserInvolved = organizerEmail === userEmail ||
            event.attendees?.some((attendee: any) =>
              attendee.emailAddress?.address?.toLowerCase() === userEmail);

    if (!isUserInvolved) return false;

    // For all-day events, adjust the end to exclude midnight of the next day
    let adjustedEventEnd = eventEnd;
    if (event.isAllDay) {
      adjustedEventEnd = new Date(eventEnd.getTime() - 1000);
    }

    // Check overlap with the adjusted period
    const hasOverlap = eventStart < dateEnd && adjustedEventEnd > dateStart;

    return hasOverlap;
  });

  const available = conflicts.length === 0;

  return {
    available,
    conflictEvents: conflicts
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
    
    return [...teamUsers, ...includedUsers];
  };

  // Get INACTIVE users that would be eligible for a shift (same team logic but status != ACTIVE)
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

  // Get all user IDs that are members of the currently selected shifts/piketts
  const getSelectedShiftsMemberIds = (): Set<string> => {
    const memberIds = new Set<string>();
    for (const shiftId of selectedShifts) {
      const shift = shifts.find(s => s.id === shiftId);
      if (!shift) continue;
      availableUsers.forEach(u => {
        const inTeam = u.teamId === shift.teamId && !(shift.excludedUserIds || []).includes(u.id);
        const included = (shift.includedUserIds || []).includes(u.id);
        if (inTeam || included) memberIds.add(u.id);
      });
    }
    for (const pikettId of selectedPiketts) {
      const pikett = piketts.find(p => p.id === pikettId);
      if (!pikett) continue;
      availableUsers.forEach(u => {
        const inTeam = u.teamId === pikett.teamId && !(pikett.excludedUserIds || []).includes(u.id);
        const included = (pikett.includedUserIds || []).includes(u.id);
        if (inTeam || included) memberIds.add(u.id);
      });
    }
    return memberIds;
  };

  const hasConsecutiveShift = (userId: string, date: string, currentAssignments: ShiftAssignment[]): boolean => {
    const currentDate = new Date(date);
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    
    const prevDateStr = prevDate.toISOString().split('T')[0];
    const nextDateStr = nextDate.toISOString().split('T')[0];
    
    return currentAssignments.some(a => 
      (a.date === prevDateStr || a.date === nextDateStr) &&
      a.assignedUsers.some(u => u.id === userId)
    );
  };

const processShiftAssignments = async () => {
  // Validation: at least one shift OR one pikett must be selected
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
    
    const dates = generateDateRange(startDate, endDate,);
    setSelectedDates(dates);
    
    const assignments: ShiftAssignment[] = [];
    const userShiftsTracking: { [userId: string]: { [shiftId: string]: number } } = {};
    const userAvailableDays: { [userId: string]: { [shiftId: string]: number } } = {};
    // Track weekly assignments to avoid same user twice in one week
    const weeklyAssignments: { [weekKey: string]: { [shiftId: string]: Set<string> } } = {};

    // Pre-compute lookup maps for O(1) access instead of O(n) .find() calls
    const shiftMap = new Map(shifts.map((s: any) => [s.id, s]));
    const pikettMap = new Map(piketts.map((p: any) => [p.id, p]));
    // Pre-compute day-of-week and adjacent dates for each date (avoid repeated new Date() calls)
    const dateDowMap = new Map(dates.map(d => [d, new Date(d).getDay()]));
    const dateAdjacentMap = new Map(dates.map(d => {
      const dt = new Date(d);
      const prev = new Date(dt); prev.setDate(prev.getDate() - 1);
      const next = new Date(dt); next.setDate(next.getDate() + 1);
      return [d, {
        prev: prev.toISOString().split('T')[0],
        next: next.toISOString().split('T')[0]
      }];
    }));
    // Fast lookup: "date|userId" -> assigned (non-pikett) for O(1) checks
    const assignedNormalShiftSet = new Set<string>();
    // Fast lookup: "date|userId" -> assigned to pikett for soft-block in shift assignment
    const assignedPikettSet = new Set<string>();
    // Fast lookup: "date|userId" -> assigned (any shift, for consecutive check)
    const assignedAnyShiftSet = new Set<string>();
    // Pre-compute active date counts per shift/pikett for MAX_LOAD
    const activeDateCountCache = new Map<string, number>();
    const getActiveDateCount = (itemId: string): number => {
      if (activeDateCountCache.has(itemId)) return activeDateCountCache.get(itemId)!;
      const item = shiftMap.get(itemId) || pikettMap.get(itemId);
      const count = dates.filter(d => {
        const dow = dateDowMap.get(d)!;
        return !item?.daysOfWeek || item.daysOfWeek.includes(dow);
      }).length;
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
        let userRotationIndex = 0;
        
        // WEEKLY ASSIGNMENT WITH ROTATION AND OOF VERIFICATION
        for (const [weekKey, weekDates] of sortedWeeks) {
          
          let assignedUserForWeek = null;
          let attempts = 0;
          const maxAttempts = shuffledUsers.length;
          
          // Find an available user for this week
          while (!assignedUserForWeek && attempts < maxAttempts) {
            const candidateUser = shuffledUsers[userRotationIndex % shuffledUsers.length];
            
            // Check it's not the same person as the previous week
            if (lastAssignedUserId && candidateUser.id === lastAssignedUserId && shuffledUsers.length > 1) {
              userRotationIndex++;
              attempts++;
              continue;
            }
            
            // Check WEEK_PARITY rule
            const wpRules = (candidateUser.rules || []).filter(
              (r: any) => r.type === 'WEEK_PARITY' && r.enabled
            );
            if (wpRules.length > 0) {
              const weekNum = parseInt(weekKey.split('-W')[1]);
              const isOddWeek = weekNum % 2 !== 0;
              const wantsOdd = wpRules[0].config.parity === 'odd';
              if ((wantsOdd && !isOddWeek) || (!wantsOdd && isOddWeek)) {
                userRotationIndex++;
                attempts++;
                continue;
              }
            }

            // Check availability for this week
            if (settings.checkCalendars) {
              let unavailableDaysCount = 0;
              for (const date of weekDates) {
                const availability = isUserAvailable(candidateUser, date, oofEvents);
                if (!availability.available) {
                  unavailableDaysCount++;
                }
              }

              // If the user is absent more than 2 days in the week, skip to the next
              if (unavailableDaysCount > 2) {
                userRotationIndex++;
                attempts++;
                continue;
              }
            }

            // This user is OK for this week
            assignedUserForWeek = candidateUser;
            lastAssignedUserId = candidateUser.id;
          }
          
          // If no available user found, leave pikett unassigned for this week
          // (respects WEEK_PARITY and availability constraints)
          
          // Create assignments for each day of the week
            for (const date of weekDates) {
              // Check if this day is configured for the pikett
              const dayOfWeek = dateDowMap.get(date)!;
              if (pikett.daysOfWeek && !pikett.daysOfWeek.includes(dayOfWeek)) {
                continue; // Skip to next day if this day is not configured
              }
            if (!assignedUserForWeek) {
              // No user available
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

              // PRIORITY 1: Check public holidays
              if (isUserOnHoliday(assignedUserForWeek.location || '', date)) {
                const holidayForDate = holidays.find(holiday => {
                  const holidayDate = new Date(holiday.date).toISOString().split('T')[0];
                  return holidayDate === date;
                });
                dayAvailable = false;
                unavailabilityReason = holidayForDate ? t('reasonHolidayWithName', { name: holidayForDate.name }) : t('reasonHoliday');
                dayConflicts = [{
                  id: 'holiday',
                  subject: holidayForDate?.name || t('reasonHoliday'),
                  start: { dateTime: new Date(date + 'T00:00:00').toISOString() },
                  end: { dateTime: new Date(date + 'T23:59:59').toISOString() },
                  showAs: 'oof' as const,
                  isAllDay: true
                }];
              }

              // PRIORITY 2: Check Outlook calendar (if not already unavailable)
              if (dayAvailable && settings.checkCalendars) {
                const availability = isUserAvailable(assignedUserForWeek, date, oofEvents);
                dayAvailable = availability.available;
                if (!dayAvailable) {
                  dayConflicts = availability.conflictEvents;
                  unavailabilityReason = t('reasonOutOfOffice');
                }
              }

              // Track pikett assignment for soft-block in PART 2.2
              if (dayAvailable) {
                assignedPikettSet.add(`${date}|${assignedUserForWeek.id}`);
                assignedAnyShiftSet.add(`${date}|${assignedUserForWeek.id}`);
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
                assignedUsers: dayAvailable ? [assignedUserForWeek] : [],
                availableUsers: shuffledUsers.filter(u => u.id !== assignedUserForWeek.id),
                unavailableUsers: [
                  ...(!dayAvailable ? [{
                    user: assignedUserForWeek,
                    reason: unavailabilityReason || t('reasonNotAvailable'),
                    conflictEvents: dayConflicts
                  }] : []),
                  ...shuffledUsers
                    .filter(u => u.id !== assignedUserForWeek.id)
                    .map(u => ({
                      user: u,
                      reason: t('reasonWeeklyRotation'),
                      conflictEvents: []
                    }))
                ],
                isPikett: true,
                isRotationAssignment: false,
              });
            }
          }

          // Move to the next user for the following week
          userRotationIndex++;
        }
        
      }
    }
    
   // PART 2: Process regular SHIFTS
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

      // ========================================
      // PART 2.1: Process ALL rotations across ALL dates FIRST
      // This ensures assignedNormalShiftSet is fully populated before
      // normal shift assignment, so consecutive shift checks work correctly.
      // ========================================
      if (settings.enableRotations) {
        for (const date of dates) {
          for (const rotationUser of rotationUsers) {
            const shiftId = getRotationShiftForUserOnDate(
              rotationUser.id,
              date,
              rotationUser
            );

            if (!shiftId) continue;

            // Check that this shift/pikett is part of the selected items
            const isSelectedShift = selectedShifts.includes(shiftId);
            const isSelectedPikett = selectedPiketts.includes(shiftId);
            if (!isSelectedShift && !isSelectedPikett) continue;

            // Find the shift or pikett by its ID
            const rotSelectedShift = isSelectedShift ? shiftMap.get(shiftId) || null : null;
            const rotSelectedPikett = isSelectedPikett ? pikettMap.get(shiftId) || null : null;
            const selectedItem = rotSelectedShift || (rotSelectedPikett ? {
              ...rotSelectedPikett,
              startTime: '00:00',
              endTime: '23:59'
            } : null);
            if (!selectedItem) continue;

            // Skip if already assigned (e.g. by PART 1 piketts)
            const alreadyHasAssignment = assignments.some(a =>
              a.date === date && a.shiftId === shiftId
            );
            if (alreadyHasAssignment) continue;

            // Check public holidays
            if (isUserOnHoliday(rotationUser.location || '', date)) continue;

            // Check part-time / work schedule
            if (settings.respectWorkPercentage) {
              const worksThisDay = isUserWorkingOnDay(rotationUser, date, selectedItem.startTime, selectedItem.endTime);
              if (!worksThisDay) continue;
            }

            // Check calendar availability
            if (settings.checkCalendars) {
              const availability = isUserAvailable(rotationUser, date, oofEvents, selectedItem);
              if (!availability.available) continue;
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

            // Check consecutive shifts (now works because ALL rotation dates are processed first)
            if (settings.avoidConsecutiveShifts && !rotSelectedPikett) {
              const adjacent = dateAdjacentMap.get(date);
              const hasConsecutiveNormalShift = adjacent ? (
                assignedNormalShiftSet.has(`${adjacent.prev}|${rotationUser.id}`) ||
                assignedNormalShiftSet.has(`${adjacent.next}|${rotationUser.id}`)
              ) : false;
              if (hasConsecutiveNormalShift) continue;
            }

            // Check eligibility
            const eligibleUsers = getEligibleUsersForShift(selectedItem);
            const isEligible = eligibleUsers.some(u => u.id === rotationUser.id);
            if (!isEligible) continue;

            // Track the assignment
            if (!userShiftsTracking[rotationUser.id]) userShiftsTracking[rotationUser.id] = {};
            if (!userShiftsTracking[rotationUser.id][shiftId]) userShiftsTracking[rotationUser.id][shiftId] = 0;
            userShiftsTracking[rotationUser.id][shiftId]++;

            // Update fast-lookup sets
            if (!rotSelectedPikett) {
              assignedNormalShiftSet.add(`${date}|${rotationUser.id}`);
            }
            assignedAnyShiftSet.add(`${date}|${rotationUser.id}`);

            // Create the assignment
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

      // Track which week we're in to re-shuffle each week
      const shiftWeekQueues: { [key: string]: any[] } = {};
      const shiftWeekPointers: { [key: string]: number } = {};

      // ========================================
      // PART 2.2: Process normal shifts (non-rotation) for each date
      // ========================================
      for (const date of dates) {
        const dailyAssignments: { [userId: string]: string[] } = {};

        // PART 2.2: Process shifts not assigned by rotation
        for (const shiftId of shiftsToProcess) {
          const shift = shiftMap.get(shiftId);
          if (!shift) continue;

          // Check if this day is configured for the shift
          const dayOfWeek = dateDowMap.get(date)!;
          if (shift.daysOfWeek && !shift.daysOfWeek.includes(dayOfWeek)) {
            continue; // Skip to next day if this day is not configured
          }

          const alreadyAssigned = assignments.some(a =>
            a.date === date && a.shiftId === shiftId && a.isRotationAssignment
          );

          if (alreadyAssigned) {
            continue;
          }

          const eligibleUsers = getEligibleUsersForShift(shift);

          const availableForThisDate: any[] = [];
          const unavailableUsers: Array<{user: any; reason: string; conflictEvents: OutlookEvent[]}> = [];

          // Add inactive users to unavailable list
          const inactiveUsers = getInactiveUsersForShift(shift);
          for (const user of inactiveUsers) {
            unavailableUsers.push({
              user,
              reason: t('reasonInactive'),
              conflictEvents: []
            });
          }

          for (const user of eligibleUsers) {
          // ========================================
          // PRIORITY 1: PUBLIC HOLIDAYS (ALWAYS FIRST)
          // ========================================
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

          // ========================================
          // PRIORITY 2: WORK AVAILABILITY
          // ========================================
          const worksThisDay = isUserWorkingOnDay(user, date, shift?.startTime, shift?.endTime);
          if (!worksThisDay) {
            unavailableUsers.push({
              user,
              reason: t('reasonNotWorkingToday'),
              conflictEvents: []
            });
            continue;
          }

          // ========================================
          // PRIORITY 2.5: USER RULES — WEEK_PARITY
          // ========================================
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

          // ========================================
          // PRIORITY 3: ALREADY ASSIGNED TODAY
          // ========================================
          const hasNormalShiftToday = assignedNormalShiftSet.has(`${date}|${user.id}`);

          if (hasNormalShiftToday) {
            unavailableUsers.push({
              user,
              reason: t('reasonAlreadyAssignedToday'),
              conflictEvents: []
            });
            continue;
          }

          // ========================================
          // PRIORITY 4: OUTLOOK CALENDAR (if enabled)
          // ========================================
          if (settings.checkCalendars) {
            const availability = isUserAvailable(user, date, oofEvents, shift);
            if (!availability.available) {
              unavailableUsers.push({
                user,
                reason: t('reasonOutOfOffice'),
                conflictEvents: availability.conflictEvents
              });
              continue;
            }
          }

          // ========================================
          // PRIORITY 5: CONSECUTIVE SHIFTS (if enabled)
          // ========================================
          // NOTE: This check only looks at shifts within the currently
          // generated period. Consecutive shifts outside this period
          // are not detected here. For a complete check, include at least
          // one day before and after your period in the generation.
          if (settings.avoidConsecutiveShifts) {
            const adjacent = dateAdjacentMap.get(date);
            const hasConsecutiveNormalShift = adjacent ? (
              assignedNormalShiftSet.has(`${adjacent.prev}|${user.id}`) ||
              assignedNormalShiftSet.has(`${adjacent.next}|${user.id}`)
            ) : false;

            if (hasConsecutiveNormalShift) {
              unavailableUsers.push({
                user,
                reason: t('reasonConsecutiveShifts'),
                conflictEvents: []
              });
              continue;
            }
          }
            
          // ========================================
          // PRIORITY 6: USER RULES — MAX_LOAD
          // ========================================
          const maxLoadRules = (user.rules || []).filter(
            (r: any) => r.type === 'MAX_LOAD' && r.enabled && r.config.shiftId === shiftId
          );
          if (maxLoadRules.length > 0) {
            const maxRule = maxLoadRules[0];
            const activeDatesForShift = getActiveDateCount(shiftId);
            const maxAssignments = Math.max(1, Math.ceil(activeDatesForShift * (maxRule.config.maxPercentage / 100)));
            const current = userShiftsTracking[user.id]?.[shiftId] || 0;
            if (current >= maxAssignments) {
              unavailableUsers.push({
                user,
                reason: t('reasonMaxLoad', { pct: maxRule.config.maxPercentage }),
                conflictEvents: []
              });
              continue;
            }
          }

          // ========================================
          // IF WE GET HERE: THE USER IS AVAILABLE
          // ========================================
          availableForThisDate.push(user);

          // Track available days per user per shift (for ratio-based balancing)
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

            // Create a new shuffled queue for each week+shift combination
            // This ensures different weekday assignments each week
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
            const weekSet = weeklyAssignments[weekKey]?.[shiftId] || new Set<string>();
            const availableIds = new Set(availableForThisDate.map(u => u.id));

            // Separate available users: prefer non-pikett users, pikett users as fallback
            const nonPikettAvailable = availableForThisDate.filter(u => !assignedPikettSet.has(`${date}|${u.id}`));
            const pikettOnlyAvailable = availableForThisDate.filter(u => assignedPikettSet.has(`${date}|${u.id}`));
            const preferredIds = new Set(nonPikettAvailable.map(u => u.id));

            // Pick next user from queue who is available today and not yet assigned this week
            let selectedUser: any = null;

            // Pass 1: find someone NOT on pikett and not yet assigned this week
            if (nonPikettAvailable.length > 0) {
              for (let i = 0; i < queue.length; i++) {
                const idx = (shiftWeekPointers[weekShiftKey] + i) % queue.length;
                const user = queue[idx];
                if (preferredIds.has(user.id) && !weekSet.has(user.id)) {
                  selectedUser = nonPikettAvailable.find(u => u.id === user.id);
                  shiftWeekPointers[weekShiftKey] = (idx + 1) % queue.length;
                  break;
                }
              }
            }

            // Pass 1b: if no non-pikett user found without week repeat, try non-pikett with week repeat
            if (!selectedUser && nonPikettAvailable.length > 0) {
              let candidateUsers = [...nonPikettAvailable];
              if (settings.balanceShifts) {
                candidateUsers.sort((a, b) => {
                  const aRatio = (userShiftsTracking[a.id]?.[shiftId] || 0) / (userAvailableDays[a.id]?.[shiftId] || 1);
                  const bRatio = (userShiftsTracking[b.id]?.[shiftId] || 0) / (userAvailableDays[b.id]?.[shiftId] || 1);
                  return aRatio - bRatio;
                });
              }
              selectedUser = candidateUsers[0];
            }

            // Pass 2: fallback — all non-pikett users exhausted, use pikett users
            if (!selectedUser && pikettOnlyAvailable.length > 0) {
              let candidateUsers = [...pikettOnlyAvailable];
              if (settings.balanceShifts) {
                candidateUsers.sort((a, b) => {
                  const aRatio = (userShiftsTracking[a.id]?.[shiftId] || 0) / (userAvailableDays[a.id]?.[shiftId] || 1);
                  const bRatio = (userShiftsTracking[b.id]?.[shiftId] || 0) / (userAvailableDays[b.id]?.[shiftId] || 1);
                  return aRatio - bRatio;
                });
              }
              selectedUser = candidateUsers[0];
            }

            // Pass 3: absolute fallback (should not happen)
            if (!selectedUser) {
              selectedUser = availableForThisDate[0];
            }

            // Track weekly assignment
            if (!weeklyAssignments[weekKey]) weeklyAssignments[weekKey] = {};
            if (!weeklyAssignments[weekKey][shiftId]) weeklyAssignments[weekKey][shiftId] = new Set();
            weeklyAssignments[weekKey][shiftId].add(selectedUser.id);

            if (!userShiftsTracking[selectedUser.id]) {
              userShiftsTracking[selectedUser.id] = {};
            }
            if (!userShiftsTracking[selectedUser.id][shiftId]) {
              userShiftsTracking[selectedUser.id][shiftId] = 0;
            }
            userShiftsTracking[selectedUser.id][shiftId]++;

            // Pre-count DOUBLE_SHIFT linked shifts for fair distribution
            const dsRulesForSelected = (selectedUser.rules || []).filter(
              (r: any) => r.type === 'DOUBLE_SHIFT' && r.enabled && r.config.triggerShiftId === shiftId
            );
            for (const dsRule of dsRulesForSelected) {
              const lsId = dsRule.config.linkedShiftId;
              if (selectedShifts.includes(lsId) || selectedPiketts.includes(lsId)) {
                if (!userShiftsTracking[selectedUser.id][lsId]) userShiftsTracking[selectedUser.id][lsId] = 0;
                userShiftsTracking[selectedUser.id][lsId]++;
              }
            }

            dailyAssignments[selectedUser.id] = [shift.name];
            selectedUser.shiftsAssigned = { ...userShiftsTracking[selectedUser.id] };
            assignedUsers = [selectedUser];

            // Update fast-lookup sets
            assignedNormalShiftSet.add(`${date}|${selectedUser.id}`);
            assignedAnyShiftSet.add(`${date}|${selectedUser.id}`);
            
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
    
    // ========================================
    // DOUBLE_SHIFT POST-PROCESSING (with chaining support)
    // ========================================
    // Fetch DB assignments first (for DS triggers from previously sent invitations)
    let freshDbAssignments: any[] = [];
    try {
      const dbResponse = await authFetch(`/api/shift-assignments?startDate=${startDate}&endDate=${endDate}`);
      if (dbResponse.ok) {
        freshDbAssignments = await dbResponse.json();
        setDbAssignments(freshDbAssignments);
      }
    } catch {
      freshDbAssignments = dbAssignments;
    }

    // Convert DB assignments to triggers for shifts NOT in the current preview
    const dbTriggerAssignments = freshDbAssignments
      .filter(dbA => dbA.status !== 'CANCELLED' && dbA.status !== 'REFUSED')
      .map(dbA => {
        const fullUser = users.find(u => u.id === dbA.userId);
        return {
          date: normalizeDbDate(dbA.date),
          shiftId: dbA.shiftId,
          shift: dbA.shift,
          assignedUsers: fullUser ? [fullUser] : [],
          isFromDb: true,
          isDoubleShiftTrigger: false as boolean | undefined,
        };
      })
      .filter(dbA => dbA.assignedUsers.length > 0 && !assignments.some(a => a.date === dbA.date && a.shiftId === dbA.shiftId));

    // Process in multiple passes to support chains (e.g. SEC→CDC and CDC→SEC)
    // Max 5 passes to prevent infinite loops
    const allDoubleShiftAdditions: any[] = [];
    const dsAssignedSet = new Set<string>(); // "date|shiftId|userId" for O(1) dedup
    const dsUserShiftCounts = new Map<string, number>(); // "userId|shiftId" -> count for MAX_LOAD
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
            // Only create DS if the linked shift is selected in current preview
            const linkedIsSelected = selectedShifts.includes(linkedShiftId) || selectedPiketts.includes(linkedShiftId);
            if (!linkedIsSelected) continue;
            // Look up in shifts first, then piketts (O(1) via Map)
            const linkedShift = shiftMap.get(linkedShiftId) || null;
            const linkedPikett = !linkedShift ? (pikettMap.get(linkedShiftId) || null) : null;
            const linkedItem = linkedShift || (linkedPikett ? { ...linkedPikett, startTime: '00:00', endTime: '23:59' } : null);
            if (!linkedItem) continue;

            // Fast dedup check using Set
            const dsKey = `${assignment.date}|${linkedShiftId}|${assignedUser.id}`;
            if (dsAssignedSet.has(dsKey)) continue;

            // Also check existing assignments
            const alreadyInAssignments = assignments.some(
              a => a.date === assignment.date && a.shiftId === linkedShiftId &&
                   a.assignedUsers.some((u: any) => u.id === assignedUser.id)
            );
            if (alreadyInAssignments) continue;

            // Check part-time / work schedule for linked shift
            if (settings.respectWorkPercentage && linkedShift) {
              const worksThisDay = isUserWorkingOnDay(assignedUser, assignment.date, linkedItem.startTime, linkedItem.endTime);
              if (!worksThisDay) continue;
            }

            // Check public holidays
            if (isUserOnHoliday(assignedUser.location || '', assignment.date)) continue;

            // Check calendar availability for linked shift
            if (settings.checkCalendars) {
              const availability = isUserAvailable(assignedUser, assignment.date, oofEvents, linkedItem);
              if (!availability.available) continue;
            }

            // DOUBLE_SHIFT replaces existing assignment (both piketts and shifts)
            // Check if another DS rule already claimed this shift+date
            if (dsAssignedSet.has(`${assignment.date}|${linkedShiftId}|*`)) continue;
            // Remove all existing entries for this shift+date so DS user takes over
            for (let i = assignments.length - 1; i >= 0; i--) {
              if (assignments[i].date === assignment.date && assignments[i].shiftId === linkedShiftId) {
                const removedUser = assignments[i].assignedUsers[0];
                if (removedUser && userShiftsTracking[removedUser.id]?.[linkedShiftId]) {
                  userShiftsTracking[removedUser.id][linkedShiftId]--;
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
              const dsMaxAssignments = Math.max(1, Math.ceil(dsActiveDates * (dsMaxRule.config.maxPercentage / 100)));
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
      if (passAdditions.length === 0) break; // No more additions to process
      allDoubleShiftAdditions.push(...passAdditions);
      // Next pass: check if these new additions trigger more rules
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
      // Only count DB-triggered DS (pre-counting already handled preview-triggered DS)
      if (ds.isFromDb) {
        if (!userShiftsTracking[ds.userId]) userShiftsTracking[ds.userId] = {};
        if (!userShiftsTracking[ds.userId][ds.shiftId]) userShiftsTracking[ds.userId][ds.shiftId] = 0;
        userShiftsTracking[ds.userId][ds.shiftId]++;
      }
    }

    // Override assigned users with real DB data for already-sent date+shift combos
    // (freshDbAssignments already fetched above before DOUBLE_SHIFT processing)
    for (const assignment of assignments) {
      const dbMatches = freshDbAssignments.filter((a: any) => {
        return normalizeDbDate(a.date) === assignment.date && a.shiftId === assignment.shiftId;
      });

      if (dbMatches.length > 0) {
        // Replace assigned users with the real DB users
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

    // Check that no assignment is in the past
    const pastAssignments = assignmentsWithUsers.filter(a => {
      const assignmentDate = new Date(a.date);
      assignmentDate.setHours(0, 0, 0, 0);
      return assignmentDate < today;
    });

    if (pastAssignments.length > 0) {
      alert(t('cannotSendPastShiftsMessage', { count: pastAssignments.length }));
      return;
    }

    // Filter out assignments where date+shift already exists in DB
    const newAssignments = assignmentsWithUsers.filter(a => {
      return getDateShiftStatus(a.date, a.shiftId) === null;
    });

    // Count skipped assignments
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
      // Get Graph token for delegated API calls
      const graphToken = await getAccessToken();
      if (!graphToken) {
        alert('Unable to get Graph access token. Please refresh and try again.');
        setSendingInvitations(false);
        return;
      }

      // STEP 1: Send Outlook invitations in parallel batches
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
      }> = [];

      // Flatten all assignment+user pairs for parallel processing
      const sendTasks: Array<{ assignment: any; user: any }> = [];
      for (const assignment of newAssignments) {
        for (const user of assignment.assignedUsers) {
          sendTasks.push({ assignment, user });
        }
      }

      setSendProgress({ current: 0, total: sendTasks.length, success: 0, errors: 0 });

      // Process in parallel batches of 5
      const BATCH_SIZE = 5;
      for (let batchStart = 0; batchStart < sendTasks.length; batchStart += BATCH_SIZE) {
        const batch = sendTasks.slice(batchStart, batchStart + BATCH_SIZE);

        const batchResults = await Promise.allSettled(batch.map(async ({ assignment, user }) => {
          const shiftStartTime = assignment.shift.startTime || '00:00';
          const shiftEndTime = assignment.shift.endTime || '23:59';

          const [startHour, startMinute] = shiftStartTime.split(':');
          const [endHour, endMinute] = shiftEndTime.split(':');

          const startDateTime = new Date(assignment.date);
          startDateTime.setHours(parseInt(startHour), parseInt(startMinute), 0);

          const endDateTime = new Date(assignment.date);
          endDateTime.setHours(parseInt(endHour), parseInt(endMinute), 0);

          if (endDateTime <= startDateTime) {
            endDateTime.setDate(endDateTime.getDate() + 1);
          }

          const event = {
            subject: `${assignment.shift.name} - ${user.displayName || `${user.firstName} ${user.lastName}`}${assignment.isPikett ? ` 🛡️ ${t('pikett').toUpperCase()}` : ''}`,
            body: {
              contentType: 'HTML',
              content: `
                <h2>${assignment.shift.name}</h2>
                <p><strong>${t('invitationEmailDate')}</strong> ${new Date(assignment.date).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <p><strong>${t('invitationEmailSchedule')}</strong> ${shiftStartTime} - ${shiftEndTime}</p>
                ${assignment.shift.description ? `<p><strong>${t('invitationEmailDescription')}</strong> ${assignment.shift.description}</p>` : ''}
                ${assignment.isPikett ? `<p><strong>${t('pikettOnCallLabel')}</strong></p>` : ''}
                <hr>
                <p><em>${t('autoGeneratedInvitation')}</em></p>
              `
            },
            start: { dateTime: startDateTime.toISOString(), timeZone: 'Europe/Zurich' },
            end: { dateTime: endDateTime.toISOString(), timeZone: 'Europe/Zurich' },
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

          const outlookResponse = await authFetch('/api/outlook/send-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Graph-Token': graphToken },
            body: JSON.stringify({ mailbox, event })
          });

          if (outlookResponse.ok) {
            const result = await outlookResponse.json();
            return { success: true, assignment, user, eventId: result.eventId };
          } else {
            const errorBody = await outlookResponse.json().catch(() => ({}));
            const graphError = errorBody?.graphError || errorBody?.error || `HTTP ${outlookResponse.status}`;
            return { success: false, user, error: graphError };
          }
        }));

        // Process batch results
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
              shiftName: assignment.shift.name
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
      }

      // STEP 2: Create in DB ONLY the assignments whose invitation succeeded
      if (successfulAssignments.length === 0) {
        const errorMessage = outlookErrors > 0
          ? `${t('noInvitationsSentError', { count: outlookErrors })}\n\n${outlookErrorDetails.join('\n')}`
          : t('noInvitationsToSend');
        setSendingInvitations(false);
        alert(errorMessage);
        return;
      }

      // Prepare data for DB (without outlookEventId first)
      const dbAssignments = successfulAssignments.map(a => ({
        date: a.date,
        shiftId: a.shiftId,
        userId: a.userId,
        status: a.status
      }));

      // Create assignments in DB
      const response = await authFetch('/api/shift-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: dbAssignments })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save assignments');
      }

      const result = await response.json();
      // STEP 3: Update each assignment with its outlookEventId
      for (const successfulAssignment of successfulAssignments) {
        const foundAssignment = result.assignments.find((a: any) => {
          const dateMatch = new Date(a.date).toDateString() === new Date(successfulAssignment.date).toDateString();
          const userMatch = a.userId === successfulAssignment.userId;
          const shiftMatch = a.shiftId === successfulAssignment.shiftId;
          return dateMatch && userMatch && shiftMatch;
        });

        if (foundAssignment) {
          await authFetch(`/api/shift-assignments/${foundAssignment.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ outlookEventId: successfulAssignment.outlookEventId })
          });
        }
      }

      // Refresh DB assignments for status badges
      fetchDbAssignments();

      // Show success dialog
      setSuccessMessage({
        outlookSuccess,
        outlookErrors,
        outlookErrorDetails,
        dbCount: result.count
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
  if (!day) return <div className={expandedCalendar ? "h-32" : "h-24"}></div>;
  
  const assignments = getAssignmentsForDate(day);
  const isToday = new Date().getDate() === day && 
                  new Date().getMonth() === calendarMonth && 
                  new Date().getFullYear() === calendarYear;
  
  // Sort: piketts first, then shifts
  const sortedAssignments = [...assignments].sort((a, b) => {
    if (a.isPikett && !b.isPikett) return -1;
    if (!a.isPikett && b.isPikett) return 1;
    return 0;
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
          // Create a deep copy of assignments for this day
          const dayAssignmentsCopy = assignments.map(a => ({...a}));
          setSelectedDayAssignments(dayAssignmentsCopy);
          setTempShiftAssignments([...shiftAssignments]); // Full copy
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
          // Color management: pikett=violet, double-shift=teal, normal=shift color
          let color = assignment.isPikett ? '#7c3aed' : assignment.isDoubleShift ? '#0d9488' : (assignment.shift?.color || '#6b7280');

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
                  <Shield className="w-3 h-3 flex-shrink-0 text-violet-600" />
                )}
                {assignment.isRotationAssignment && !assignment.isPikett && !assignment.isDoubleShift && (
                  <RotateCw className="w-3 h-3 flex-shrink-0" style={{ color }} />
                )}
                <span 
                  style={{ color }} 
                  className="font-medium text-xs truncate"
                >
                  {assignment.shift?.name || 'Shift'}
                </span>
                {assignment.assignedUsers.length > 0 ? (
                  <>
                    <span className="text-slate-700 truncate text-xs">
                      : {assignment.assignedUsers[0].firstName} {assignment.assignedUsers[0].lastName}
                    </span>
                    {(() => {
                      const status = getDateShiftStatus(assignment.date, assignment.shiftId);
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
                  
                  <ScrollArea className="h-auto border rounded-lg p-2 bg-violet-50/30">
                    <div className="space-y-2">
                      {piketts.filter((p: any) => p.status === 'ACTIVE').map((pikett: any) => {
                        const isSelected = selectedPiketts.includes(pikett.id);

                        return (
                          <label
                            key={pikett.id}
                            className={`flex items-center space-x-2 p-1.5 rounded cursor-pointer text-xs
                              ${isSelected ? 'bg-violet-100' : 'hover:bg-violet-50'}`}
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
                                <Shield className="w-3 h-3 text-violet-600" />
                                <span className="font-medium text-violet-900">{pikett.name}</span>
                              </div>
                              <span className="text-xs text-violet-700">
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
                    {selectedShifts.map((shiftId, index) => {
                      const shift = shifts.find((s: any) => s.id === shiftId);
                      const count = shiftAssignments.filter(a => 
                        a.shiftId === shiftId && a.assignedUsers.length > 0
                      ).length;
                      const rotationCount = shiftAssignments.filter(a => 
                        a.shiftId === shiftId && a.isRotationAssignment
                      ).length;
                      const emptyCount = shiftAssignments.filter(a => 
                        a.shiftId === shiftId && a.assignedUsers.length === 0
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
                              <Badge className="bg-purple-100 text-purple-700 text-xs border-0">
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

            {/* Calendar */}
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <CardTitle className="text-xl font-semibold text-slate-800">
                      {new Date(calendarYear, calendarMonth).toLocaleDateString(locale, {
                        month: 'long',
                        year: 'numeric'
                      })}
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (calendarMonth === 0) {
                            setCalendarMonth(11);
                            setCalendarYear(calendarYear - 1);
                          } else {
                            setCalendarMonth(calendarMonth - 1);
                          }
                        }}
                        className="hover:bg-secondary/20"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const today = new Date();
                          setCalendarMonth(today.getMonth());
                          setCalendarYear(today.getFullYear());
                        }}
                        className="hover:bg-secondary/20"
                      >
                        {t('today')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (calendarMonth === 11) {
                            setCalendarMonth(0);
                            setCalendarYear(calendarYear + 1);
                          } else {
                            setCalendarMonth(calendarMonth + 1);
                          }
                        }}
                        className="hover:bg-secondary/20"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
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
                    <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
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
                            <Label htmlFor="avoid-consecutive">{t('avoidConsecutive')}</Label>
                            <Checkbox
                              id="avoid-consecutive"
                              checked={settings.avoidConsecutiveShifts}
                              onCheckedChange={(checked) =>
                                setSettings({...settings, avoidConsecutiveShifts: !!checked})
                              }
                            />
                          </div>
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
                      <Shield className="w-3 h-3 text-violet-600" />
                      <span className="text-slate-600">Pikett</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Link2 className="w-3 h-3 text-teal-600" />
                      <span className="text-slate-600">{t('doubleShiftAuto')}</span>
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
                const rotationUsers = availableUsers.filter(u => u.rotationConfig?.patternId && memberIds.has(u.id));
                return rotationUsers.length > 0 ? (
                <Card className="bg-white border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-slate-800 flex items-center">
                      <RotateCw className="w-4 h-4 mr-2 text-orange-600" />
                      {t('usersWithRotationCount', { count: rotationUsers.length })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[280px] overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                      {rotationUsers
                        .map(user => {
                          const pattern = rotationPatterns.find(p => p.id === user.rotationConfig.patternId);
                          return (
                            <div key={user.id} className="flex items-center justify-between p-2.5 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg">
                              <div className="flex items-center space-x-2.5">
                                <Avatar className="w-8 h-8">
                                  <AvatarFallback className="text-xs bg-gradient-to-br from-orange-500 to-amber-600 text-white">
                                    {user.firstName?.[0]}{user.lastName?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-semibold text-slate-800">{user.firstName} {user.lastName}</p>
                                  <p className="text-xs text-slate-600">
                                    {pattern?.name || t('unknownPattern')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="text-xs text-slate-500">
                                  {pattern?.cycleLength || 0} sem.
                                </span>
                              </div>
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
                        outOfOfficeEvents
                          .filter((e: OutlookEvent) => e.showAs === 'oof')
                          .forEach((event: OutlookEvent) => {
                            const eventStart = new Date(event.start.dateTime);
                            const eventEnd = new Date(event.end.dateTime);
                            const periodStart = new Date(startDate);
                            const periodEnd = new Date(endDate);

                            if (eventStart <= periodEnd && eventEnd >= periodStart) {
                              const userEmail = event.organizer?.emailAddress?.address?.toLowerCase();
                              const user = availableUsers.find(u => u.email?.toLowerCase() === userEmail);
                              if (user && memberIds.has(user.id)) {
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
                        outOfOfficeEvents
                          .filter((e: OutlookEvent) => e.showAs === 'oof')
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

                        const dateFormat = { day: 'numeric', month: 'short' } as const;

                        return groupedUsers.map(({ user, events }) => {
                          // Sort events by start date and merge overlapping/adjacent ranges
                          const sorted = [...events].sort((a, b) =>
                            new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime()
                          );

                          // Merge overlapping/contiguous periods
                          const mergedRanges: Array<{ start: Date; end: Date; reasons: Set<string> }> = [];
                          for (const evt of sorted) {
                            const evtStart = new Date(evt.start.dateTime);
                            const evtEnd = evt.isAllDay
                              ? new Date(new Date(evt.end.dateTime).getTime() - 1000)
                              : new Date(evt.end.dateTime);
                            const reason = evt.showAs === 'oof' ? t('reasonOutOfOffice') : (evt.subject || t('absence'));
                            const last = mergedRanges[mergedRanges.length - 1];

                            // Merge if ranges overlap or are adjacent (within 1 day)
                            if (last && evtStart.getTime() <= last.end.getTime() + 86400000) {
                              if (evtEnd > last.end) last.end = evtEnd;
                              last.reasons.add(reason);
                            } else {
                              mergedRanges.push({ start: evtStart, end: evtEnd, reasons: new Set([reason]) });
                            }
                          }

                          // Build display string for date ranges
                          const rangeStrings = mergedRanges.map(range => {
                            const isSingleDay = range.start.toDateString() === range.end.toDateString();
                            if (isSingleDay) {
                              return range.start.toLocaleDateString(locale, dateFormat);
                            }
                            return `${range.start.toLocaleDateString(locale, dateFormat)} → ${range.end.toLocaleDateString(locale, dateFormat)}`;
                          });

                          // Collect unique reasons
                          const allReasons = new Set<string>();
                          mergedRanges.forEach(r => r.reasons.forEach(reason => allReasons.add(reason)));
                          const reasonText = Array.from(allReasons).join(', ');

                          return (
                            <div key={user.id} className="flex items-center justify-between p-2.5 bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg">
                              <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                                <Avatar className="w-8 h-8 flex-shrink-0">
                                  <AvatarFallback className="text-xs bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                                    {user.firstName?.[0]}{user.lastName?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-slate-800 truncate">{user.firstName} {user.lastName}</p>
                                  <p className="text-xs text-slate-600 truncate">
                                    {reasonText}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-0.5 flex-shrink-0 ml-2">
                                {rangeStrings.map((rangeStr, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-100 rounded-md">
                                    <Calendar className="w-3.5 h-3.5 text-violet-600" />
                                    <span className="text-xs font-medium text-violet-700 whitespace-nowrap">
                                      {rangeStr}
                                    </span>
                                  </div>
                                ))}
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
                              <Badge className="bg-purple-100 text-purple-800 text-xs">
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
                                        // Get ALL shifts for this user on this day IN REAL TIME
                                        const getOtherShiftsForUser = (userId: string) => {
                                          const currentDayAssignments = selectedDayAssignments?.filter(a => 
                                            a.date === assignment.date && 
                                            a.assignedUsers.some(u => u.id === userId) &&
                                            a.shiftId !== assignment.shiftId
                                          ) || [];
                                          
                                          return currentDayAssignments;
                                        };
                                        
                                        // Eligible users for this pikett
                                        const eligibleUsers = assignment.isPikett 
                                          ? availableUsers.filter(u => {
                                              const pikett = piketts.find(p => p.id === assignment.shiftId);
                                              if (!pikett) return false;
                                              const inTeam = u.teamId === pikett.teamId;
                                              const included = (pikett as any).includedUserIds?.includes(u.id);
                                              const excluded = (pikett as any).excludedUserIds?.includes(u.id);
                                              const isEligible = (inTeam && !excluded) || included;
                                              // ADDED: Check if user works on this day
                                              const worksThisDay = isUserWorkingOnDay(u, assignment.date);
                                              return isEligible && worksThisDay;
                                            })
                                          : availableUsers.filter(u => {
                                              const shift = shifts.find(s => s.id === assignment.shiftId);
                                              if (!shift) return false;
                                              const inTeam = u.teamId === shift.teamId;
                                              const included = (shift as any).includedUserIds?.includes(u.id);
                                              const excluded = (shift as any).excludedUserIds?.includes(u.id);
                                              const isEligible = (inTeam && !excluded) || included;
                                              // ADDED: Check if user works on this day
                                              const worksThisDay = isUserWorkingOnDay(u, assignment.date, shift.startTime, shift.endTime);
                                              return isEligible && worksThisDay;
                                            });

                                        // Recalculate unavailableUsers in real time
                                        // For OOF, we need to recalculate with shift hours
                                        const shift = shifts.find(s => s.id === assignment.shiftId);
                                        const pikett = piketts.find(p => p.id === assignment.shiftId);
                                        const currentShift = shift || pikett;

                                        // ===================================================
                                        // CHECK ALL CONSTRAINTS FOR ALL ELIGIBLE USERS
                                        // ===================================================

                                        // Calculate dates to check consecutive shifts
                                        const assignmentDate = new Date(assignment.date);
                                        const prevDate = new Date(assignmentDate);
                                        prevDate.setDate(prevDate.getDate() - 1);
                                        const nextDate = new Date(assignmentDate);
                                        nextDate.setDate(nextDate.getDate() + 1);
                                        const prevDateStr = prevDate.toISOString().split('T')[0];
                                        const nextDateStr = nextDate.toISOString().split('T')[0];

                                        // Categorize each eligible user
                                        const usersWithOtherShifts: any[] = [];
                                        const usersWithOOF: Array<{user: any; reason: string; conflictEvents: OutlookEvent[]}> = [];
                                        const usersWithConsecutiveShifts: Array<{user: any; reason: string; conflictEvents: OutlookEvent[]}> = [];
                                        const usersNotWorkingToday: Array<{user: any; reason: string; conflictEvents: OutlookEvent[]}> = [];
                                        const available: any[] = [];

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
                                            continue;
                                          }

                                          // 2. Check Out of Office
                                          if (currentShift) {
                                            const availability = isUserAvailable(user, assignment.date, outOfOfficeEvents, currentShift);
                                            if (!availability.available) {
                                              usersWithOOF.push({
                                                user,
                                                reason: t('reasonOutOfOffice'),
                                                conflictEvents: availability.conflictEvents || []
                                              });
                                              continue;
                                            }
                                          }

                                          // 3. Check if not working this day (already filtered in eligibleUsers but double check)
                                          const worksThisDay = isUserWorkingOnDay(user, assignment.date, shift?.startTime, shift?.endTime);
                                          if (!worksThisDay) {
                                            usersNotWorkingToday.push({
                                              user,
                                              reason: t('reasonNotWorkingToday'),
                                              conflictEvents: []
                                            });
                                            continue;
                                          }

                                          // 4. Check consecutive shifts
                                          const hasConsecutiveShift = tempShiftAssignments.some(a => {
                                            return (a.date === prevDateStr || a.date === nextDateStr) &&
                                                  a.assignedUsers.some(u => u.id === user.id);
                                          });

                                          if (hasConsecutiveShift) {
                                            usersWithConsecutiveShifts.push({
                                              user,
                                              reason: t('reasonConsecutiveShifts'),
                                              conflictEvents: []
                                            });
                                            continue;
                                          }

                                          // 5. If no constraint, user is available
                                          available.push(user);
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
                                            {available.map(user => (
                                              <SelectItem key={user.id} value={user.id}>
                                                <div className="flex items-center gap-2">
                                                  <Avatar className="w-6 h-6 flex-shrink-0">
                                                    <AvatarFallback className="text-xs">
                                                      {user.firstName?.[0]}{user.lastName?.[0]}
                                                    </AvatarFallback>
                                                  </Avatar>
                                                  <span>{user.firstName} {user.lastName}</span>
                                                </div>
                                              </SelectItem>
                                            ))}
                                            
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
                                                        <div className="flex gap-1 flex-shrink-0">
                                                          {otherShifts.map((s, idx) => (
                                                            <Badge key={idx} variant="outline" className="text-xs bg-orange-50 border-orange-200 whitespace-nowrap">
                                                              {s.shift?.name || 'Shift'}
                                                            </Badge>
                                                          ))}
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
                                                {currentlyUnavailable.map(item => (
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
                                                      <Badge variant="outline" className="text-xs bg-red-50 border-red-200 flex-shrink-0 whitespace-nowrap">
                                                        {item.reason}
                                                      </Badge>
                                                    </div>
                                                  </SelectItem>
                                                ))}
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
                                              const status = getDateShiftStatus(assignment.date, assignment.shiftId);
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
                                  <Badge className="text-xs border-0 bg-purple-100 text-purple-700">
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
                                      className="hover:bg-purple-600/10 hover:text-purple-600 hover:border-purple-600 transition-colors"
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
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                        <Alert className="border-orange-200 bg-orange-50">
                          <AlertCircle className="h-4 w-4 text-orange-600" />
                          <AlertDescription className="text-orange-800">
                            {assignment.noAssignmentReason || t('noPersonAvailableForShift')}
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