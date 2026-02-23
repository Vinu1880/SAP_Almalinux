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
  UserCheck,
  UserX,
  Filter,
  Save,
  Download,
  Search,
  Plus,
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
  rotationPriority?: 'high' | 'medium' | 'low';
  isPikett?: boolean;
  isManualOverride?: boolean;
  overrideReason?: string;
  noAssignmentReason?: string;
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

    const getCurrentWeek = () => {
      const date = new Date();
      const year = date.getFullYear();
      const firstDayOfYear = new Date(year, 0, 1);
      const days = Math.floor((date.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.ceil((days + firstDayOfYear.getDay() + 1) / 7);
      return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
    };

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
  const getDateShiftStatus = (date: string, shiftId: string): 'PENDING' | 'ACCEPTED' | 'REFUSED' | 'CANCELLED' | null => {
    const matches = dbAssignments.filter((a: any) => normalizeDbDate(a.date) === date && a.shiftId === shiftId);
    if (matches.length === 0) return null;
    // If any is ACCEPTED, show ACCEPTED; if any REFUSED, show REFUSED; else PENDING
    if (matches.some((a: any) => a.status === 'ACCEPTED')) return 'ACCEPTED';
    if (matches.some((a: any) => a.status === 'REFUSED')) return 'REFUSED';
    if (matches.some((a: any) => a.status === 'CANCELLED')) return 'CANCELLED';
    return 'PENDING';
  };

  // Settings
  const loadSettings = () => {
  if (typeof window === 'undefined') {
    // Server side - return default settings
    return {
      avoidConsecutiveShifts: true,
      balanceShifts: true,
      checkCalendars: true,
      respectWorkPercentage: true,
      prioritySystem: true,
      enableRotations: true
    };
  }
  
  const savedSettings = localStorage.getItem('shiftSettings');
  if (savedSettings) {
    try {
      return JSON.parse(savedSettings);
    } catch (e) {
      // Settings parse error - fallback to defaults
    }
  }
  return {
    avoidConsecutiveShifts: true,
    balanceShifts: true,
    checkCalendars: true,
    respectWorkPercentage: true,
    prioritySystem: true,
    enableRotations: true
  };
};

  // Function to map cities to cantons
// NOTE: duplicate function (first occurrence)
const getUserCantonFromLocation = (location: string): string => {
  const cantonMapping: { [key: string]: string } = {
    'bern': 'BE', 'berne': 'BE',
    'zurich': 'ZH', 'dubendorf': 'ZH',
    'yverdon': 'VD', 'yverdon-les-bains': 'VD'
  };
  
  const normalizedLocation = location.toLowerCase();
  return cantonMapping[normalizedLocation] || 'BE';
};

  // Utility function to check if a user works on a given day
const isUserWorkingOnDay = (user: any, date: string, shiftTime?: string, shiftEndTime?: string): boolean => {
  if (!user.availability) return true; // If no config, assume they work every day

  // Function to map cities to cantons
const getUserCantonFromLocation = (location: string): string => {
  const cantonMapping: { [key: string]: string } = {
    'bern': 'BE', 'berne': 'BE',
    'zurich': 'ZH', 'winterthur': 'ZH',
    'lausanne': 'VD', 'yverdon': 'VD', 'yverdon-les-bains': 'VD',
    'geneva': 'GE', 'geneve': 'GE',
    'basel': 'BS', 'bale': 'BS',
    'lucerne': 'LU', 'stgallen': 'SG', 'chur': 'GR',
    'fribourg': 'FR', 'neuchatel': 'NE', 'sion': 'VS',
    'lugano': 'TI', 'bellinzona': 'TI', 'aarau': 'AG', 'zug': 'ZG'
  };
  
  const normalizedLocation = location.toLowerCase();
  return cantonMapping[normalizedLocation] || 'BE';
};

// Function to check public holidays

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

  // Retrieve active piketts
  const [activePiketts, setActivePiketts] = useState<any[]>([]);

  useEffect(() => {
    const savedPiketts = localStorage.getItem('piketts');
    if (savedPiketts) {
      const piketts = JSON.parse(savedPiketts);
      // Filter active piketts for the selected period
      const filtered = piketts.filter((p: any) => {
        if (p.status !== 'ACTIVE') return false;
        // Check if the pikett is in the period
        const pikettWeek = p.startWeek;
        // Logic to check the period
        return true; // To be refined as needed
      });
      setActivePiketts(filtered);
    }
  }, [startDate, endDate]);

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
  ): { shiftId: string | null; priority: 'high' | 'medium' | 'low' } => {
    if (!settings.enableRotations || !user.rotationConfig?.patternId) {
      return { shiftId: null, priority: 'low' };
    }
    
    const pattern = rotationPatterns.find(p => p.id === user.rotationConfig.patternId);
    if (!pattern) {
      // Pattern not found for user
      return { shiftId: null, priority: user.rotationConfig.priority || 'low' };
    }
    
    // Calculate which week of the cycle we are in
    const startDateObj = new Date(startDate);
    const currentDateObj = new Date(date);
    
    // Calculate number of weeks since start
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksSinceStart = Math.floor((currentDateObj.getTime() - startDateObj.getTime()) / msPerWeek);
    
    // Determine the week in the cycle (0-based)
    const weekInCycle = weeksSinceStart % pattern.cycleLength;
    
    const weekPattern = pattern.weeks[weekInCycle];
    if (!weekPattern) {
      return { shiftId: null, priority: user.rotationConfig.priority || 'low' };
    }

    // Get the day of the week
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][currentDateObj.getDay()];
    const shiftIds = weekPattern[dayOfWeek] || [];

    return { 
      shiftId: shiftIds[0] || null, 
      priority: user.rotationConfig.priority || 'medium' 
    };
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

  const fetchUsersFromCalendars = async (): Promise<any[]> => {
    setIsLoadingUsers(true);

    try {
      const usersMap = new Map<string, any>();

      // Add ALL users from the DB with their complete data
      users.forEach(dbUser => {
        usersMap.set(dbUser.email.toLowerCase(), {
          id: dbUser.id,
          email: dbUser.email,
          displayName: `${dbUser.firstName} ${dbUser.lastName}`,
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
          workPercent: dbUser.workPercent || 100,
          status: dbUser.status,
          rotationConfig: dbUser.rotationConfig || null,
          teamId: dbUser.teamId || null,
          availability: dbUser.availability || null,
          role: dbUser.role || null,
          location: dbUser.location || null
        });
      });
      
      const allUsers = Array.from(usersMap.values());

      setAvailableUsers(allUsers);
      return allUsers;
      
    } catch (error) {
      // Graph API error - fallback to DB users
      const dbUsers = users.map(dbUser => ({
        id: dbUser.id,
        email: dbUser.email,
        displayName: `${dbUser.firstName} ${dbUser.lastName}`,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        workPercent: dbUser.workPercent || 100,
        status: dbUser.status,
        rotationConfig: dbUser.rotationConfig || null,
        teamId: dbUser.teamId || null,
        availability: dbUser.availability || null,
        role: dbUser.role || null,
        location: dbUser.location || null
      }));
      setAvailableUsers(dbUsers);
      return dbUsers;
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
  const fetchOutOfOfficeFromOwnCalendar = async (): Promise<OutlookEvent[]> => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken || !startDate || !endDate) return [];

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
              return event.showAs === 'oof' || event.showAs === 'busy';
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
    
    for (let d = new Date(startDateObj); d <= endDateObj; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
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
        const pikett = piketts.find(p => p.id === pikettId);
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
          
          // If no available user found, force assignment of the next in rotation
          if (!assignedUserForWeek && shuffledUsers.length > 0) {
            assignedUserForWeek = shuffledUsers[userRotationIndex % shuffledUsers.length];
            lastAssignedUserId = assignedUserForWeek.id;
          }
          
          // Create assignments for each day of the week
            for (const date of weekDates) {
              // Check if this day is configured for the pikett
              const dateObj = new Date(date);
              const dayOfWeek = dateObj.getDay();
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
                rotationPriority: 'high'
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
                rotationPriority: 'high'
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
          const shiftA = shifts.find(s => s.id === a);
          const shiftB = shifts.find(s => s.id === b);
          const membersA = getEligibleUsersForShift(shiftA).length;
          const membersB = getEligibleUsersForShift(shiftB).length;
          return membersA - membersB;
        });
      }
      
      // Track which week we're in to re-shuffle each week
      const shiftWeekQueues: { [key: string]: any[] } = {};
      const shiftWeekPointers: { [key: string]: number } = {};

      for (const date of dates) {
        const dailyAssignments: { [userId: string]: string[] } = {};

        // PART 2.1: Process rotations if enabled
        if (settings.enableRotations) {
          for (const rotationUser of rotationUsers) {
            const { shiftId, priority } = getRotationShiftForUserOnDate(
              rotationUser.id,
              date,
              rotationUser
            );
            
            if (!shiftId) {
              continue;
            }

            // Check that this shift is part of the selected shifts in the planner
            if (!selectedShifts.includes(shiftId)) {
              continue;
            }

            // Find the shift directly by its ID
            const selectedShift = shifts.find(s => s.id === shiftId);
            if (!selectedShift) {
              continue;
            }

            // Check availability - Public holidays
            if (isUserOnHoliday(rotationUser.location || '', date)) {
              continue;
            }

            // Check calendar availability
            if (settings.checkCalendars) {
              const availability = isUserAvailable(rotationUser, date, oofEvents, selectedShift);
              if (!availability.available) {
                continue;
              }
            }

            // Check that the user is eligible for this shift
            const eligibleUsers = getEligibleUsersForShift(selectedShift);
            const isEligible = eligibleUsers.some(u => u.id === rotationUser.id);
            
            if (!isEligible) {
              continue;
            }

            // Track the assignment
            if (!userShiftsTracking[rotationUser.id]) {
              userShiftsTracking[rotationUser.id] = {};
            }
            if (!userShiftsTracking[rotationUser.id][shiftId]) {
              userShiftsTracking[rotationUser.id][shiftId] = 0;
            }
            userShiftsTracking[rotationUser.id][shiftId]++;
            
            dailyAssignments[rotationUser.id] = [selectedShift.name];

            // Create the assignment
            assignments.push({
              date,
              shiftId: selectedShift.id,
              shift: selectedShift,
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
              rotationPriority: priority
            });
          }
        }
        
        // PART 2.2: Process shifts not assigned by rotation
        for (const shiftId of shiftsToProcess) {
          const shift = shifts.find(s => s.id === shiftId);
          if (!shift) continue;
          
          // Check if this day is configured for the shift
          const dateObj = new Date(date);
          const dayOfWeek = dateObj.getDay();
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
          // PRIORITY 3: ALREADY ASSIGNED TODAY
          // ========================================
          const hasNormalShiftToday = assignments.some(a => 
            a.date === date && 
            !a.isPikett && 
            a.assignedUsers.some(u => u.id === user.id)
          );
          
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
            const hasConsecutiveNormalShift = assignments.some(a => {
              if (a.isPikett) return false;
              const currentDate = new Date(date);
              const prevDate = new Date(currentDate);
              prevDate.setDate(prevDate.getDate() - 1);
              const nextDate = new Date(currentDate);
              nextDate.setDate(nextDate.getDate() + 1);

              const prevDateStr = prevDate.toISOString().split('T')[0];
              const nextDateStr = nextDate.toISOString().split('T')[0];

              return (a.date === prevDateStr || a.date === nextDateStr) &&
                    a.assignedUsers.some(u => u.id === user.id);
            });

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

            // Pick next user from queue who is available today and not yet assigned this week
            let selectedUser: any = null;

            // Pass 1: find someone not yet assigned this week
            for (let i = 0; i < queue.length; i++) {
              const idx = (shiftWeekPointers[weekShiftKey] + i) % queue.length;
              const user = queue[idx];
              if (availableIds.has(user.id) && !weekSet.has(user.id)) {
                selectedUser = availableForThisDate.find(u => u.id === user.id);
                shiftWeekPointers[weekShiftKey] = (idx + 1) % queue.length;
                break;
              }
            }

            // Pass 2: if all available users already assigned this week, pick by ratio
            if (!selectedUser) {
              let candidateUsers = [...availableForThisDate];
              if (settings.balanceShifts) {
                candidateUsers.sort((a, b) => {
                  const aRatio = (userShiftsTracking[a.id]?.[shiftId] || 0) / (userAvailableDays[a.id]?.[shiftId] || 1);
                  const bRatio = (userShiftsTracking[b.id]?.[shiftId] || 0) / (userAvailableDays[b.id]?.[shiftId] || 1);
                  return aRatio - bRatio;
                });
              }
              selectedUser = candidateUsers[0];
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
            
            dailyAssignments[selectedUser.id] = [shift.name];
            selectedUser.shiftsAssigned = { ...userShiftsTracking[selectedUser.id] };
            assignedUsers = [selectedUser];
            
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
    
    // Fetch fresh DB assignments to override with real users
    let freshDbAssignments: any[] = [];
    try {
      const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
      const sDateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-01`;
      const eDateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      const dbResponse = await authFetch(`/api/shift-assignments?startDate=${sDateStr}&endDate=${eDateStr}`);
      if (dbResponse.ok) {
        freshDbAssignments = await dbResponse.json();
        setDbAssignments(freshDbAssignments);
      }
    } catch {
      // Use existing state as fallback
      freshDbAssignments = dbAssignments;
    }

    // Override assigned users with real DB data for already-sent date+shift combos
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
      // STEP 1: Send Outlook invitations first
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

        for (const assignment of newAssignments) {
          for (const user of assignment.assignedUsers) {
            try {
              const shiftStartTime = assignment.shift.startTime || '00:00';
              const shiftEndTime = assignment.shift.endTime || '23:59';

              const [startHour, startMinute] = shiftStartTime.split(':');
              const [endHour, endMinute] = shiftEndTime.split(':');

              const startDateTime = new Date(assignment.date);
              startDateTime.setHours(parseInt(startHour), parseInt(startMinute), 0);

              const endDateTime = new Date(assignment.date);
              endDateTime.setHours(parseInt(endHour), parseInt(endMinute), 0);

              // If the shift ends after midnight, add 1 day
              if (endDateTime <= startDateTime) {
                endDateTime.setDate(endDateTime.getDate() + 1);
              }

              const event = {
                subject: `${assignment.shift.name}${assignment.isPikett ? ` 🛡️ ${t('pikett').toUpperCase()}` : ''}`,
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
                      address: user.email,
                      name: user.displayName || `${user.firstName} ${user.lastName}`
                    },
                    type: 'required'
                  }
                ],
                location: {
                  displayName: assignment.shift.location || user.location || t('notSpecified')
                },
                isReminderOn: true,
                reminderMinutesBeforeStart: 1440, // 24h before
                responseRequested: true,
                allowNewTimeProposals: false,
                showAs: assignment.isPikett ? 'oof' : 'busy',
                categories: [
                  assignment.isPikett ? t('pikett').toUpperCase() : t('shift'),
                  assignment.shift.name
                ]
              };

              const mailbox = assignment.shift.senderMailbox || 'me';

              // Send via server-side API route (uses application permissions)
              // so the organizer is the shared mailbox, not the admin user
              const outlookResponse = await authFetch('/api/outlook/send-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mailbox, event })
              });

              if (outlookResponse.ok) {
                const result = await outlookResponse.json();
                outlookSuccess++;

                // Add to the list of successful assignments
                successfulAssignments.push({
                  date: assignment.date,
                  shiftId: assignment.shiftId,
                  userId: user.id,
                  status: 'PENDING',
                  outlookEventId: result.eventId,
                  userEmail: user.email,
                  shiftName: assignment.shift.name
                });
              } else {
                const errorBody = await outlookResponse.json().catch(() => ({}));
                const graphError = errorBody?.graphError || errorBody?.error || `HTTP ${outlookResponse.status}`;
                outlookErrorDetails.push(`${user.email}: ${graphError}`);
                outlookErrors++;
              }
            } catch (error) {
              outlookErrorDetails.push(`${user.email}: ${error instanceof Error ? error.message : 'Network error'}`);
              outlookErrors++;
            }
          }
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

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(calendarMonth, calendarYear);
    const firstDay = getFirstDayOfMonth(calendarMonth, calendarYear);
    const days: (number | null)[] = [];
    
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
    
    for (let i = 0; i < adjustedFirstDay; i++) {
      days.push(null);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
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
  
  const maxVisible = expandedCalendar ? assignments.length : 3;
  const visibleAssignments = assignments.slice(0, maxVisible);
  const hiddenCount = assignments.length - maxVisible;
  
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
          // Improved color management
          let color = '#dc2626'; // Red by default for piketts

          if (!assignment.isPikett) {
            // For regular shifts, use the shift color from the DB
            color = assignment.shift?.color || '#6b7280';
          }
          
          return (
            <div 
              key={`${assignment.shiftId}-${idx}`} 
              className="rounded px-1 py-0.5 text-xs truncate relative"
              style={{ 
                backgroundColor: assignment.isPikett ? '#dc262615' : `${color}15`,
                borderLeft: `2px solid ${color}`
              }}
            >
              <div className="flex items-center gap-0.5">
                {assignment.isPikett && (
                  <Shield className="w-3 h-3 flex-shrink-0 text-red-600" />
                )}
                {assignment.isRotationAssignment && !assignment.isPikett && (
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
                      const dotColor = status === 'ACCEPTED' ? 'bg-green-500' : status === 'REFUSED' ? 'bg-red-500' : status === 'PENDING' ? 'bg-blue-500' : 'bg-gray-400';
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
                  
                  <ScrollArea className="h-auto border rounded-lg p-2 bg-red-50/30">
                    <div className="space-y-2">
                      {piketts.filter((p: any) => p.status === 'ACTIVE').map((pikett: any) => {
                        const isSelected = selectedPiketts.includes(pikett.id);
                        
                        return (
                          <label
                            key={pikett.id}
                            className={`flex items-center space-x-2 p-1.5 rounded cursor-pointer text-xs
                              ${isSelected ? 'bg-red-100' : 'hover:bg-red-50'}`}
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
                                <Shield className="w-3 h-3 text-red-600" />
                                <span className="font-medium text-red-900">{pikett.name}</span>
                              </div>
                              <span className="text-xs text-red-700">
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
                      <div className="w-3 h-3 bg-green-100 rounded"></div>
                      <span className="text-slate-600">{t('assignedLegend')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-orange-100 rounded"></div>
                      <span className="text-slate-600">{t('unfilledLegend')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <RotateCw className="w-3 h-3 text-purple-600" />
                      <span className="text-slate-600">{t('automaticRotation')}</span>
                    </div>
                    <div className="border-l pl-4 flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-slate-600">{t('statusPending')}</span>
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
              {/* Users with rotation */}
              {availableUsers.filter(u => u.rotationConfig?.patternId).length > 0 && (
                <Card className="bg-white border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-slate-800 flex items-center">
                      <RotateCw className="w-4 h-4 mr-2 text-purple-600" />
                      {t('usersWithRotationCount', { count: availableUsers.filter(u => u.rotationConfig?.patternId).length })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-[280px] overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                      {availableUsers
                        .filter(u => u.rotationConfig?.patternId)
                        .map(user => {
                          const pattern = rotationPatterns.find(p => p.id === user.rotationConfig.patternId);
                          return (
                            <div key={user.id} className="flex items-center justify-between p-2.5 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg">
                              <div className="flex items-center space-x-2.5">
                                <Avatar className="w-8 h-8">
                                  <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
                                    {user.firstName?.[0]}{user.lastName?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-semibold text-slate-800">{user.firstName} {user.lastName}</p>
                                  <p className="text-xs text-slate-600">
                                    {pattern?.name || t('unknownPattern')}
                                  </p>
                                </div>
                                {(() => {
                                  const week = getCurrentWeek();
                                  const savedPiketts = localStorage.getItem('piketts');
                                  const piketts = savedPiketts ? JSON.parse(savedPiketts) : [];
                                  const userPikett = piketts.find((p: any) =>
                                    p.userId === user.id &&
                                    p.startWeek === week &&
                                    p.status === 'ACTIVE'
                                  );

                                  if (userPikett) {
                                    return (
                                      <Badge className="bg-red-100 text-red-700 text-xs border-0">
                                        <Shield className="w-3 h-3 mr-1" />
                                        {t('pikett')}
                                      </Badge>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                              <div className="flex flex-col items-end gap-0.5">
                                <Badge className={`text-xs border-0 ${
                                  user.rotationConfig.priority === 'high' ? 'bg-red-100 text-red-700' :
                                  user.rotationConfig.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {user.rotationConfig.priority === 'high' ? t('high') :
                                   user.rotationConfig.priority === 'medium' ? t('medium') : t('low')}
                                </Badge>
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
              )}

              {/* Users Out of Office */}
              {startDate && endDate && (
                <Card className="bg-white border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-slate-800 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-2 text-orange-600" />
                      {t('outOfOffice')} ({(() => {
                        const usersOOF = new Set<string>();
                        outOfOfficeEvents.forEach((event: OutlookEvent) => {
                          const eventStart = new Date(event.start.dateTime);
                          const eventEnd = new Date(event.end.dateTime);
                          const periodStart = new Date(startDate);
                          const periodEnd = new Date(endDate);

                          if (eventStart <= periodEnd && eventEnd >= periodStart) {
                            usersOOF.add(event.organizer?.emailAddress?.address || '');
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

                        outOfOfficeEvents.forEach((event: OutlookEvent) => {
                          const eventStart = new Date(event.start.dateTime);
                          const eventEnd = new Date(event.end.dateTime);
                          const periodStart = new Date(startDate);
                          const periodEnd = new Date(endDate);

                          if (eventStart <= periodEnd && eventEnd >= periodStart) {
                            const userEmail = event.organizer?.emailAddress?.address?.toLowerCase();
                            if (userEmail) {
                              const user = availableUsers.find(u => u.email?.toLowerCase() === userEmail);
                              if (user) {
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
                            <div key={user.id} className="flex items-center justify-between p-2.5 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg">
                              <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                                <Avatar className="w-8 h-8 flex-shrink-0">
                                  <AvatarFallback className="text-xs bg-gradient-to-br from-orange-500 to-amber-600 text-white">
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
                                  <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-100 rounded-md">
                                    <Calendar className="w-3.5 h-3.5 text-orange-600" />
                                    <span className="text-xs font-medium text-orange-700 whitespace-nowrap">
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
              )}
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
                                              if (status === 'PENDING') return (
                                                <Badge className="text-xs mt-2 bg-blue-100 text-blue-700 border-0 inline-flex items-center gap-1">
                                                  <Clock className="w-3 h-3" />
                                                  {t('statusPending')}
                                                </Badge>
                                              );
                                              if (status === 'ACCEPTED') return (
                                                <Badge className="text-xs mt-2 bg-green-100 text-green-700 border-0 inline-flex items-center gap-1">
                                                  <CheckCircle className="w-3 h-3" />
                                                  {t('statusAccepted')}
                                                </Badge>
                                              );
                                              if (status === 'REFUSED') return (
                                                <Badge className="text-xs mt-2 bg-red-100 text-red-700 border-0 inline-flex items-center gap-1">
                                                  <XCircle className="w-3 h-3" />
                                                  {t('statusRefused')}
                                                </Badge>
                                              );
                                              if (status === 'CANCELLED') return (
                                                <Badge className="text-xs mt-2 bg-gray-100 text-gray-600 border-0 inline-flex items-center gap-1">
                                                  <XCircle className="w-3 h-3" />
                                                  {t('statusCancelled')}
                                                </Badge>
                                              );
                                              return (
                                                <Badge variant="outline" className="text-xs mt-2 bg-slate-50 text-slate-500 inline-flex items-center gap-1">
                                                  <Send className="w-3 h-3" />
                                                  {t('statusNotSent')}
                                                </Badge>
                                              );
                                            })()}
                                          </div>
                                        </>
                                      )}
                                    </div>

                              <div className="flex items-center gap-2">
                                {assignment.isRotationAssignment && !editingAssignment && (
                                  <Badge className={`text-xs border-0 ${
                                    assignment.rotationPriority === 'high' ? 'bg-red-100 text-red-700' :
                                    assignment.rotationPriority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 
                                    'bg-green-100 text-green-700'
                                  }`}>
                                    {t('priority')}: {assignment.rotationPriority === 'high' ? t('high') :
                                              assignment.rotationPriority === 'medium' ? t('medium') : t('low')}
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