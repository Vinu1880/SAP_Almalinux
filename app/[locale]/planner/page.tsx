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

// Import des hooks
import { useAuth } from '@/contexts/AuthContext';
import { useShifts } from '@/lib/hooks/useShifts';
import { useUsers } from '@/lib/hooks/useUsers';
import { useTeams } from '@/lib/hooks/useTeams';
import { usePiketts } from '@/lib/hooks/usePiketts';
import { useHolidays } from '@/lib/hooks/useHolidays';
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

// Couleurs disponibles pour les shifts (10 couleurs distinctes)
const SHIFT_COLORS = [
  '#ef4444', // Rouge
  '#3b82f6', // Bleu
  '#10b981', // Vert
  '#eab308', // Jaune
  '#8b5cf6', // Violet
  '#f97316', // Orange
  '#92400e', // Brun
  '#06b6d4', // Turquoise
  '#ec4899', // Rose
  '#6b7280', // Gris
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

// DEBUG: Afficher les jours fériés chargés
useEffect(() => {
  console.log('=== HOLIDAYS LOADED IN PLANNER ===');
  console.log(`Total holidays: ${holidays.length}`);
  holidays.forEach(h => {
    console.log(`- ${h.name} | Date: ${h.date} | Cantons: ${h.cantons.join(', ')}`);
  });
  console.log('==================================');
}, [holidays]);

    const getCurrentWeek = () => {
      const date = new Date();
      const year = date.getFullYear();
      const firstDayOfYear = new Date(year, 0, 1);
      const days = Math.floor((date.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.ceil((days + firstDayOfYear.getDay() + 1) / 7);
      return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
    };

  // États
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
  const [randomSeed, setRandomSeed] = useState(0);
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
    dbCount: number;
  } | null>(null);

  // Auth
  const { getAccessToken } = useAuth();

  // Hooks
  const { shifts, loading: shiftsLoading } = useShifts();
  const { users, loading: usersLoading } = useUsers();
  const { teams, loading: teamsLoading } = useTeams();

  // Paramètres
  const loadSettings = () => {
  if (typeof window === 'undefined') {
    // Serveur side - retourner les paramètres par défaut
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
      console.error('Erreur lors du chargement des settings:', e);
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

  // Fonction pour mapper les villes aux cantons
// SUPPRIMER CETTE FONCTION (première occurrence)
const getUserCantonFromLocation = (location: string): string => {
  const cantonMapping: { [key: string]: string } = {
    'bern': 'BE', 'berne': 'BE',
    'zurich': 'ZH', 'dübendorf': 'ZH',
    'yverdon': 'VD', 'yverdon-les-bains': 'VD'
  };
  
  const normalizedLocation = location.toLowerCase();
  return cantonMapping[normalizedLocation] || 'BE';
};

  // Fonction utilitaire pour vérifier si un utilisateur travaille un jour donné
const isUserWorkingOnDay = (user: any, date: string, shiftTime?: string): boolean => {
  if (!user.availability) return true; // Si pas de config, on assume qu'il travaille tous les jours

  // Fonction pour mapper les villes aux cantons
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

// Fonction pour vérifier les jours fériés
  
  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay(); // 0 = dimanche, 1 = lundi, etc.
  
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[dayOfWeek];
  
  const dayAvailability = user.availability[dayName];
  if (!dayAvailability) return true;
  
  // Vérifier selon l'heure du shift si fournie
  if (shiftTime) {
    const [hour] = shiftTime.split(':').map(Number);
    // Considérer le matin comme avant 13h, l'après-midi après
    if (hour < 13) {
      return dayAvailability.morning === true;
    } else {
      return dayAvailability.afternoon === true;
    }
  }
  
  // Si pas d'heure spécifiée, vérifier si au moins une partie de la journée est disponible
  return dayAvailability.morning === true || dayAvailability.afternoon === true;
};

  // Récupération des piketts actifs
  const [activePiketts, setActivePiketts] = useState<any[]>([]);

  useEffect(() => {
    const savedPiketts = localStorage.getItem('piketts');
    if (savedPiketts) {
      const piketts = JSON.parse(savedPiketts);
      // Filtrer les piketts actifs pour la période sélectionnée
      const filtered = piketts.filter((p: any) => {
        if (p.status !== 'ACTIVE') return false;
        // Vérifier si le pikett est dans la période
        const pikettWeek = p.startWeek;
        // Logique pour vérifier la période
        return true; // À affiner selon vos besoins
      });
      setActivePiketts(filtered);
    }
  }, [startDate, endDate]);

  const [settings, setSettings] = useState(() => loadSettings());

  // Validation des dates
  const validateDates = (start: string, end: string): string => {
    if (!start || !end) {
      return '';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDateObj = new Date(start);
    const endDateObj = new Date(end);

    // Vérifier que la date de début n'est pas après la date de fin
    if (startDateObj > endDateObj) {
      return t('startDateCannotBeAfterEnd');
    }

    // Vérifier que les dates ne sont pas dans le passé
    if (startDateObj < today) {
      return t('startDateCannotBeInPast');
    }

    if (endDateObj < today) {
      return t('endDateCannotBeInPast');
    }

    return '';
  };

  // Fonction rotation améliorée
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
      console.log(`Pattern ${user.rotationConfig.patternId} non trouvé pour ${user.firstName}`);
      return { shiftId: null, priority: user.rotationConfig.priority || 'low' };
    }
    
    // Calculer quelle semaine du cycle nous sommes
    const startDateObj = new Date(startDate);
    const currentDateObj = new Date(date);
    
    // Calculer le nombre de semaines depuis le début
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksSinceStart = Math.floor((currentDateObj.getTime() - startDateObj.getTime()) / msPerWeek);
    
    // Déterminer la semaine dans le cycle (0-based)
    const weekInCycle = weeksSinceStart % pattern.cycleLength;
    
    const weekPattern = pattern.weeks[weekInCycle];
    if (!weekPattern) {
      console.log(`Pas de pattern pour la semaine ${weekInCycle + 1}`);
      return { shiftId: null, priority: user.rotationConfig.priority || 'low' };
    }
    
    // Obtenir le jour de la semaine
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][currentDateObj.getDay()];
    const shiftIds = weekPattern[dayOfWeek] || [];
    
    console.log(`${user.firstName} - ${date} (${dayOfWeek}) - Semaine ${weekInCycle + 1}/${pattern.cycleLength}: ${shiftIds.length > 0 ? 'Shift assigné' : 'Libre'}`);
    
    return { 
      shiftId: shiftIds[0] || null, 
      priority: user.rotationConfig.priority || 'medium' 
    };
  };

  // FONCTION DE MÉLANGE AMÉLIORÉE - Utilise le randomSeed global + date + shift
  const shuffleArray = <T,>(array: T[], seed: number, additionalSeed: string = ''): T[] => {
    const shuffled = [...array];
    let currentIndex = shuffled.length;
    
    // Combine le seed global avec un hash de la chaîne additionnelle
    const hashCode = (str: string): number => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash);
    };
    
    const combinedSeed = seed + hashCode(additionalSeed);
    
    const random = (index: number) => {
      const x = Math.sin(combinedSeed + index) * 10000;
      return x - Math.floor(x);
    };
    
    while (currentIndex !== 0) {
      const randomIndex = Math.floor(random(currentIndex) * currentIndex);
      currentIndex--;
      [shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
    }
    
    return shuffled;
  };

  const fetchUsersFromCalendars = async (): Promise<any[]> => {
    console.log('Récupération des utilisateurs...');
    setIsLoadingUsers(true);
    
    try {
      const usersMap = new Map<string, any>();
      
      // Ajouter TOUS les utilisateurs de la DB avec leurs données complètes
      users.forEach(dbUser => {
        console.log(`User ${dbUser.firstName}:`, {
          hasRotationConfig: !!dbUser.rotationConfig,
          rotationConfig: dbUser.rotationConfig,
          location: dbUser.location
        });

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
      
      const usersWithRotation = allUsers.filter(u => u.rotationConfig?.patternId);
      console.log('=== UTILISATEURS AVEC ROTATION ===');
      console.log(`Total: ${usersWithRotation.length}`);
      usersWithRotation.forEach(u => {
        console.log(`- ${u.firstName} ${u.lastName}:`, u.rotationConfig);
      });
      console.log('================================');
      
      setAvailableUsers(allUsers);
      return allUsers;
      
    } catch (error) {
      console.error('Erreur:', error);
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
  
  // Mettre à jour dans selectedDayAssignments (pour l'affichage dans le dialog)
  const updatedDayAssignments = selectedDayAssignments?.map(a => {
    if (a.date === assignmentDate && a.shiftId === assignmentShiftId) {
      // Trouver l'assignation originale dans shiftAssignments
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

      // Vérifier si c'est différent de l'assignation originale
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
        // Ne pas modifier unavailableUsers - le filtrage se fait à l'affichage
        unavailableUsers: a.unavailableUsers
      };
    }
    return a;
  });
  
  // Mettre à jour dans tempShiftAssignments (pour la sauvegarde finale)
  // IMPORTANT: Chercher aussi les piketts, pas seulement les shifts normaux
  const updatedTempAssignments = tempShiftAssignments.map(a => {
    if (a.date === assignmentDate && a.shiftId === assignmentShiftId) {
      // Trouver l'assignation originale dans shiftAssignments
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

      // Vérifier si c'est différent de l'assignation originale
      const originalUserId = originalAssignment?.assignedUsers[0]?.id;
      const isChanged = originalUserId !== tempAssignedUser;

      // Garder toutes les propriétés du pikett si c'est un pikett
      return {
        ...a,
        assignedUsers: selectedUser ? [selectedUser] : [],
        isManualOverride: isChanged || originalConstraint || hasOtherShift ? true : false,
        overrideReason: isChanged ? t('manualModification') :
                       originalConstraint ? originalConstraint.reason :
                       hasOtherShift ? t('alreadyAssignedToAnotherShift') :
                       undefined,
        // Ne pas modifier unavailableUsers - le filtrage se fait à l'affichage
        unavailableUsers: a.unavailableUsers,
        // Préserver les propriétés spécifiques aux piketts
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
      console.log('❌ Pas de dates définies');
      return [];
    }

    console.log('🔍 Recherche des événements Out of Office...');
    console.log('📅 Période:', startDate, 'à', endDate);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        console.error('❌ Pas de token d\'authentification disponible');
        return [];
      }

      const startDateTime = new Date(startDate + 'T00:00:00').toISOString();
      const endDateTime = new Date(endDate + 'T23:59:59').toISOString();

      const allOutOfOfficeEvents: OutlookEvent[] = [];

      const calendarsResponse = await fetch('https://graph.microsoft.com/v1.0/me/calendars', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!calendarsResponse.ok) {
        console.error('❌ Erreur lors de la récupération des calendriers:', calendarsResponse.status);
        const errorText = await calendarsResponse.text();
        console.error('Détails:', errorText);
        return [];
      }

      const calendarsData = await calendarsResponse.json();
      console.log(`📆 ${calendarsData.value.length} calendrier(s) trouvé(s)`);

      for (const calendar of calendarsData.value) {
        console.log(`\n📖 Calendrier: "${calendar.name}"`);
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
            console.log(`   📋 ${eventsData.value.length} événement(s) dans la période`);

            // Log tous les événements pour debug
            eventsData.value.forEach((event: any) => {
              console.log(`      - "${event.subject}" | showAs: "${event.showAs}"`);
            });

            const oofEvents = eventsData.value.filter((event: OutlookEvent) => {
              const isOof = event.showAs === 'oof';
              const hasOofKeywords = event.subject && (
                event.subject.toLowerCase().includes('out of office') ||
                event.subject.toLowerCase().includes('ooo') ||
                event.subject.toLowerCase().includes('absent') ||
                event.subject.toLowerCase().includes('congé') ||
                event.subject.toLowerCase().includes('vacances') ||
                event.subject.toLowerCase().includes('holiday') ||
                event.subject.toLowerCase().includes('vacation')
              );
              const matched = isOof || hasOofKeywords;
              if (matched) {
                console.log(`      ✅ OOF trouvé: "${event.subject}" (showAs: ${event.showAs})`);
              }
              return matched;
            });

            oofEvents.forEach((event: OutlookEvent) => {
              allOutOfOfficeEvents.push({
                ...event,
                calendarName: calendar.name,
                calendarId: calendar.id
              });
            });
          } else {
            console.error(`   ❌ Erreur pour récupérer les événements:`, eventsResponse.status);
          }
        } catch (error) {
          console.log(`   ❌ Erreur pour calendrier ${calendar.name}:`, error);
        }
      }

      console.log(`\n✅ Total événements OOF trouvés: ${allOutOfOfficeEvents.length}`);
      if (allOutOfOfficeEvents.length > 0) {
        console.log('Détails des OOF:');
        allOutOfOfficeEvents.forEach(event => {
          console.log(`  - ${event.subject} (${event.start.dateTime} → ${event.end.dateTime})`);
        });
      }
      return allOutOfOfficeEvents;
    } catch (error) {
      console.error('❌ Erreur globale:', error);
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

  // Si un shift est fourni avec des horaires, on vérifie les heures précises
  // Sinon, on vérifie toute la journée (00:00-23:59)
  let dateStart: Date;
  let dateEnd: Date;

  if (shift?.startTime && shift?.endTime) {
    // Normaliser le format de l'heure (enlever les secondes si présentes)
    const normalizeTime = (time: string) => {
      const parts = time.split(':');
      return `${parts[0]}:${parts[1]}`;
    };

    const startTime = normalizeTime(shift.startTime);
    const endTime = normalizeTime(shift.endTime);

    dateStart = new Date(date + `T${startTime}:00`);
    dateEnd = new Date(date + `T${endTime}:00`);

    console.log(`🕐 Vérification OOF pour shift "${shift.name}" le ${date}`);
    console.log(`   Shift: ${startTime} - ${endTime}`);
    console.log(`   Période shift: ${dateStart.toISOString()} → ${dateEnd.toISOString()}`);
  } else {
    dateStart = new Date(date + 'T00:00:00');
    dateEnd = new Date(date + 'T23:59:59');
    console.log(`🕐 Vérification OOF pour toute la journée du ${date}`);
  }

  const conflicts = oofEvents.filter(event => {
    const eventStart = new Date(event.start.dateTime);
    const eventEnd = new Date(event.end.dateTime);
    const organizerEmail = event.organizer?.emailAddress?.address?.toLowerCase() || '';

    // Vérifier si l'utilisateur est concerné par cet événement
    const isUserInvolved = organizerEmail === userEmail ||
            event.attendees?.some((attendee: any) =>
              attendee.emailAddress?.address?.toLowerCase() === userEmail);

    if (!isUserInvolved) return false;

    // Pour les événements "toute la journée", ajuster la fin pour exclure minuit du jour suivant
    let adjustedEventEnd = eventEnd;
    if (event.isAllDay) {
      adjustedEventEnd = new Date(eventEnd.getTime() - 1000);
    }

    // Vérifier le chevauchement avec la période ajustée
    const hasOverlap = eventStart < dateEnd && adjustedEventEnd > dateStart;

    if (hasOverlap) {
      console.log(`   ⚠️  Conflit détecté avec "${event.subject}"`);
      console.log(`      Event: ${eventStart.toISOString()} → ${eventEnd.toISOString()}`);
      console.log(`      IsAllDay: ${event.isAllDay}, showAs: ${event.showAs}`);
    }

    return hasOverlap;
  });

  const available = conflicts.length === 0;
  console.log(`   ${available ? '✅ Disponible' : '❌ Non disponible'} (${conflicts.length} conflit(s))`);

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
  // Validation : au moins un shift OU un pikett doit être sélectionné
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
    console.log('=== DÉBUT DU PROCESSUS D\'ASSIGNATION ===');
    console.log(`Shifts sélectionnés: ${selectedShifts.length}`);
    console.log(`Piketts sélectionnés: ${selectedPiketts.length}`);
    console.log(`Période: ${startDate} à ${endDate}`);
    console.log(`Random Seed actuel: ${randomSeed}`);
    
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
    
    // PARTIE 1: Traiter les PIKETTS sélectionnés
    if (selectedPiketts.length > 0) {
      console.log('\n=== TRAITEMENT DES PIKETTS ===');
      
      for (const pikettId of selectedPiketts) {
        const pikett = piketts.find(p => p.id === pikettId);
        if (!pikett) continue;
        
        console.log(`Traitement du pikett: ${pikett.name}`);
        
        // Obtenir les utilisateurs éligibles pour ce pikett
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
        
        console.log(`  ${eligibleUsers.length} utilisateurs éligibles pour le pikett`);
        
        if (eligibleUsers.length === 0) {
          console.log('  ⚠ Aucun utilisateur éligible pour ce pikett');
          continue;
        }
        
        // Organiser les dates par semaine ISO
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
        
        console.log(`  Nombre de semaines à couvrir: ${weekGroups.size}`);
        
        const sortedWeeks = Array.from(weekGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        const shuffledUsers = shuffleArray(eligibleUsers, randomSeed, `pikett-${pikettId}`);
        
        // Tracker pour éviter les assignations consécutives
        let lastAssignedUserId: string | null = null;
        let userRotationIndex = 0;
        
        // ASSIGNATION PAR SEMAINE AVEC ROTATION ET VÉRIFICATION OOF
        for (const [weekKey, weekDates] of sortedWeeks) {
          console.log(`\n  Traitement semaine ${weekKey}:`);
          
          let assignedUserForWeek = null;
          let attempts = 0;
          const maxAttempts = shuffledUsers.length;
          
          // Chercher un utilisateur disponible pour cette semaine
          while (!assignedUserForWeek && attempts < maxAttempts) {
            const candidateUser = shuffledUsers[userRotationIndex % shuffledUsers.length];
            
            // Vérifier que ce n'est pas la même personne que la semaine précédente
            if (lastAssignedUserId && candidateUser.id === lastAssignedUserId && shuffledUsers.length > 1) {
              console.log(`    ${candidateUser.firstName} a déjà fait la semaine précédente, on passe au suivant`);
              userRotationIndex++;
              attempts++;
              continue;
            }
            
            // Vérifier la disponibilité pour cette semaine
            if (settings.checkCalendars) {
              let unavailableDaysCount = 0;
              for (const date of weekDates) {
                const availability = isUserAvailable(candidateUser, date, oofEvents);
                if (!availability.available) {
                  unavailableDaysCount++;
                }
              }
              
              // Si l'utilisateur est absent plus de 2 jours dans la semaine, passer au suivant
              if (unavailableDaysCount > 2) {
                console.log(`    ${candidateUser.firstName} est OOF ${unavailableDaysCount}/${weekDates.length} jours, on passe au suivant`);
                userRotationIndex++;
                attempts++;
                continue;
              }
            }
            
            // Cet utilisateur est OK pour cette semaine
            assignedUserForWeek = candidateUser;
            lastAssignedUserId = candidateUser.id;
            console.log(`    ✓ Assigné: ${assignedUserForWeek.firstName} ${assignedUserForWeek.lastName}`);
          }
          
          // Si aucun utilisateur disponible trouvé, forcer l'assignation du prochain dans la rotation
          if (!assignedUserForWeek && shuffledUsers.length > 0) {
            assignedUserForWeek = shuffledUsers[userRotationIndex % shuffledUsers.length];
            lastAssignedUserId = assignedUserForWeek.id;
            console.log(`    ⚠ Assignation forcée: ${assignedUserForWeek.firstName} ${assignedUserForWeek.lastName}`);
          }
          
          // Créer les assignations pour chaque jour de la semaine
            for (const date of weekDates) {
              // Vérifier si ce jour est configuré pour le pikett
              const dateObj = new Date(date);
              const dayOfWeek = dateObj.getDay();
              if (pikett.daysOfWeek && !pikett.daysOfWeek.includes(dayOfWeek)) {
                continue; // Passer au jour suivant si ce jour n'est pas configuré
              }
            if (!assignedUserForWeek) {
              // Aucun utilisateur disponible
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
              // Vérifier la disponibilité pour ce jour spécifique
              let dayAvailable = true;
              let dayConflicts: OutlookEvent[] = [];
              let unavailabilityReason = '';

              // PRIORITÉ 1: Vérifier les jours fériés
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
                console.log(`    ⚠ ${assignedUserForWeek.firstName} - Jour férié: ${holidayForDate?.name || 'Unknown'}`);
              }

              // PRIORITÉ 2: Vérifier le calendrier Outlook (si pas déjà indisponible)
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
          
          // Passer au prochain utilisateur pour la semaine suivante
          userRotationIndex++;
        }
        
        // Résumé de la rotation
        console.log('\n  === RÉSUMÉ ROTATION PIKETT ===');
        for (const [weekKey, weekDates] of sortedWeeks) {
          const weekAssignments = assignments.filter(a => 
            a.isPikett && 
            a.shiftId === pikettId && 
            weekDates.includes(a.date)
          );
          const assignedUser = weekAssignments.find(a => a.assignedUsers.length > 0)?.assignedUsers[0];
          if (assignedUser) {
            const daysPresent = weekAssignments.filter(a => a.assignedUsers.length > 0).length;
            console.log(`  ${weekKey}: ${assignedUser.firstName} ${assignedUser.lastName} (${daysPresent}/${weekDates.length} jours)`);
          }
        }
      }
    }
    
   // PARTIE 2: Traiter les SHIFTS normaux
    if (selectedShifts.length > 0) {
      console.log('\n=== TRAITEMENT DES SHIFTS ===');
      
      const rotationUsers = currentUsers.filter(u => u.rotationConfig?.patternId);
      console.log(`${rotationUsers.length} utilisateur(s) avec rotation configurée`);
      
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
      
      for (const date of dates) {
        const dailyAssignments: { [userId: string]: string[] } = {};
        console.log(`\n=== Traitement du ${date} ===`);
        
        // PARTIE 2.1: Traiter les rotations si activées
        if (settings.enableRotations) {
          for (const rotationUser of rotationUsers) {
            const { shiftId, priority } = getRotationShiftForUserOnDate(
              rotationUser.id,
              date,
              rotationUser
            );
            
            if (!shiftId) {
              console.log(`  ${rotationUser.firstName}: Pas de shift en rotation ce jour`);
              continue;
            }
            
            // Vérifier que ce shift fait partie des shifts sélectionnés dans le planner
            if (!selectedShifts.includes(shiftId)) {
              console.log(`  ${rotationUser.firstName}: Shift non sélectionné dans le planner`);
              continue;
            }
            
            // Trouver directement le shift par son ID
            const selectedShift = shifts.find(s => s.id === shiftId);
            if (!selectedShift) {
              console.log(`  ${rotationUser.firstName}: Shift ${shiftId} introuvable`);
              continue;
            }
            
            console.log(`  ${rotationUser.firstName}: rotation ${selectedShift.name} (priorité: ${priority})`);

            // Vérifier la disponibilité - Jours fériés
            if (isUserOnHoliday(rotationUser.location || '', date)) {
              const holidayForDate = holidays.find(holiday => {
                const holidayDate = new Date(holiday.date).toISOString().split('T')[0];
                return holidayDate === date;
              });
              console.log(`    ❌ Non disponible (jour férié: ${holidayForDate?.name || 'Unknown'})`);
              continue;
            }

            // Vérifier la disponibilité calendrier
            if (settings.checkCalendars) {
              const availability = isUserAvailable(rotationUser, date, oofEvents, selectedShift);
              if (!availability.available) {
                console.log(`    ❌ Non disponible (OOF)`);
                continue;
              }
            }
            
            // Vérifier que l'utilisateur est éligible pour ce shift
            const eligibleUsers = getEligibleUsersForShift(selectedShift);
            const isEligible = eligibleUsers.some(u => u.id === rotationUser.id);
            
            if (!isEligible) {
              console.log(`    ❌ Non éligible pour ${selectedShift.name}`);
              continue;
            }
            
            // Tracker l'assignation
            if (!userShiftsTracking[rotationUser.id]) {
              userShiftsTracking[rotationUser.id] = {};
            }
            if (!userShiftsTracking[rotationUser.id][shiftId]) {
              userShiftsTracking[rotationUser.id][shiftId] = 0;
            }
            userShiftsTracking[rotationUser.id][shiftId]++;
            
            dailyAssignments[rotationUser.id] = [selectedShift.name];
            
            console.log(`    ✓ Assigné à ${selectedShift.name}`);
            
            // Créer l'assignation
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
        
        // PARTIE 2.2: Traiter les shifts non assignés par rotation
        for (const shiftId of shiftsToProcess) {
          const shift = shifts.find(s => s.id === shiftId);
          if (!shift) continue;
          
          // Vérifier si ce jour est configuré pour le shift
          const dateObj = new Date(date);
          const dayOfWeek = dateObj.getDay();
          if (shift.daysOfWeek && !shift.daysOfWeek.includes(dayOfWeek)) {
            continue; // Passer au jour suivant si ce jour n'est pas configuré
          }
          
          const alreadyAssigned = assignments.some(a => 
            a.date === date && a.shiftId === shiftId && a.isRotationAssignment
          );
          
          if (alreadyAssigned) {
            console.log(`  ${shift.name}: Déjà assigné par rotation`);
            continue;
          }
          
          console.log(`  ${shift.name}: Recherche d'un utilisateur disponible`);
          
          const eligibleUsers = getEligibleUsersForShift(shift);
          console.log(`    ${eligibleUsers.length} utilisateurs éligibles`);
          
          const availableForThisDate: any[] = [];
          const unavailableUsers: Array<{user: any; reason: string; conflictEvents: OutlookEvent[]}> = [];
          
          for (const user of eligibleUsers) {
          // ========================================
          // PRIORITÉ 1: JOURS FÉRIÉS (TOUJOURS EN PREMIER)
          // ========================================
          if (isUserOnHoliday(user.location || '', date)) {
            const holidayForDate = holidays.find(holiday => {
              const holidayDate = new Date(holiday.date).toISOString().split('T')[0];
              return holidayDate === date;
            });

            console.log(`❌ ${user.firstName} ${user.lastName} - JOUR FÉRIÉ: ${holidayForDate?.name || 'Unknown'} (Canton: ${user.location})`);

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
          // PRIORITÉ 2: DISPONIBILITÉ DE TRAVAIL
          // ========================================
          const worksThisDay = isUserWorkingOnDay(user, date, shift?.startTime);
          if (!worksThisDay) {
            unavailableUsers.push({
              user,
              reason: t('reasonNotWorkingToday'),
              conflictEvents: []
            });
            continue;
          }

          // ========================================
          // PRIORITÉ 3: DÉJÀ ASSIGNÉ AUJOURD'HUI
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
          // PRIORITÉ 4: CALENDRIER OUTLOOK (si activé)
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
          // PRIORITÉ 5: SHIFTS CONSÉCUTIFS (si activé)
          // ========================================
          // NOTE: Cette vérification regarde uniquement les shifts dans la période
          // actuellement générée. Les shifts consécutifs en dehors de cette période
          // ne sont pas détectés ici. Pour une vérification complète, incluez au moins
          // un jour avant et après votre période dans la génération.
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
          // SI ON ARRIVE ICI: L'UTILISATEUR EST DISPONIBLE
          // ========================================
          availableForThisDate.push(user);
          }
          
          console.log(`    ${availableForThisDate.length} utilisateurs disponibles`);
          
          let assignedUsers: any[] = [];
          let noAssignmentReason: string | undefined = undefined;

          if (availableForThisDate.length > 0) {
            const seedString = `${shiftId}-${date}`;
            let candidateUsers = shuffleArray(availableForThisDate, randomSeed, seedString);
            
            if (settings.balanceShifts) {
              candidateUsers.sort((a, b) => {
                const aCount = (userShiftsTracking[a.id]?.[shiftId] || 0);
                const bCount = (userShiftsTracking[b.id]?.[shiftId] || 0);
                if (aCount !== bCount) return aCount - bCount;
                return 0;
              });
            }
            
            const selectedUser = candidateUsers[0];
            
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
            
            console.log(`    → Assigné à : ${selectedUser.displayName || selectedUser.firstName}`);
          } else {
            console.log(`    ⚠ Aucune personne disponible`);
            
            // Déterminer la raison principale
            const holidayCount = unavailableUsers.filter(u => u.reason.includes(t('reasonHoliday'))).length;
            const oofCount = unavailableUsers.filter(u => u.reason === t('reasonOutOfOffice')).length;
            const workDayCount = unavailableUsers.filter(u => u.reason === t('reasonNotWorkingToday')).length;
            const consecutiveCount = unavailableUsers.filter(u => u.reason === t('reasonConsecutiveShifts')).length;
            const alreadyAssignedCount = unavailableUsers.filter(u => u.reason === t('reasonAlreadyAssignedToday')).length;

            if (holidayCount > 0 && holidayCount >= unavailableUsers.length * 0.5) {
              // Trouver le nom du jour férié pour cette date
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
    
    console.log('\n=== PROCESSUS TERMINÉ ===');
    console.log(`Total assignations créées: ${assignments.length}`);
    console.log(`Piketts assignés: ${assignments.filter(a => a.isPikett).length}`);
    console.log(`Shifts normaux: ${assignments.filter(a => !a.isPikett).length}`);
    console.log(`Shifts avec rotation: ${assignments.filter(a => a.isRotationAssignment && !a.isPikett).length}`);
    console.log(`Shifts non pourvus: ${assignments.filter(a => a.assignedUsers.length === 0).length}`);
    
    setRandomSeed(prev => prev + 1);
    setShiftAssignments(assignments);
    
  } catch (error) {
    console.error('Erreur:', error);
    alert(t('processingError'));
  } finally {
    setIsProcessingShifts(false);
  }
};

  const sendShiftInvitations = async () => {
    // Validation des dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const assignmentsWithUsers = shiftAssignments.filter(a => a.assignedUsers.length > 0);

    if (assignmentsWithUsers.length === 0) {
      alert(t('noAssignmentsToSend'));
      return;
    }

    // Vérifier qu'aucune assignation n'est dans le passé
    const pastAssignments = assignmentsWithUsers.filter(a => {
      const assignmentDate = new Date(a.date);
      assignmentDate.setHours(0, 0, 0, 0);
      return assignmentDate < today;
    });

    if (pastAssignments.length > 0) {
      alert(t('cannotSendPastShiftsMessage', { count: pastAssignments.length }));
      return;
    }

    console.log('Envoi des invitations Outlook et enregistrement dans la base de données...');
    setSendingInvitations(true);

    try {
      // ÉTAPE 1 : Envoyer d'abord les invitations Outlook
      let outlookSuccess = 0;
      let outlookErrors = 0;
      const successfulAssignments: Array<{
        date: string;
        shiftId: string;
        userId: string;
        status: string;
        outlookEventId: string;
        userEmail: string;
        shiftName: string;
      }> = [];

      const accessToken = await getAccessToken();
      if (!accessToken) {
        alert('❌ Access token manquant ou invalide.\nVeuillez vous reconnecter.');
        return;
      }

      console.log('Envoi des invitations Outlook...');

        for (const assignment of assignmentsWithUsers) {
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

              // Si le shift se termine après minuit, ajouter 1 jour
              if (endDateTime <= startDateTime) {
                endDateTime.setDate(endDateTime.getDate() + 1);
              }

              const event = {
                subject: `${assignment.shift.name}${assignment.isPikett ? ' 🛡️ PIKETT' : ''}`,
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
                reminderMinutesBeforeStart: 1440, // 24h avant
                responseRequested: true,
                allowNewTimeProposals: false,
                showAs: assignment.isPikett ? 'oof' : 'busy',
                categories: [
                  assignment.isPikett ? t('pikett').toUpperCase() : t('shift'),
                  assignment.shift.name
                ]
              };

              const outlookResponse = await fetch('https://graph.microsoft.com/v1.0/me/events', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(event)
              });

              if (outlookResponse.ok) {
                const createdEvent = await outlookResponse.json();
                console.log(`✓ Invitation Outlook envoyée à ${user.email} pour ${assignment.shift.name} le ${assignment.date}`);
                outlookSuccess++;

                // Ajouter à la liste des assignations réussies
                successfulAssignments.push({
                  date: assignment.date,
                  shiftId: assignment.shiftId,
                  userId: user.id,
                  status: 'PENDING',
                  outlookEventId: createdEvent.id,
                  userEmail: user.email,
                  shiftName: assignment.shift.name
                });
              } else {
                const error = await outlookResponse.json();
                console.error(`✗ Erreur Outlook pour ${user.email}:`, error);
                outlookErrors++;
              }
            } catch (error) {
              console.error(`✗ Erreur lors de l'envoi à ${user.email}:`, error);
              outlookErrors++;
            }
          }
        }

      console.log(`Invitations Outlook: ${outlookSuccess} envoyées, ${outlookErrors} erreurs`);

      // ÉTAPE 2 : Créer dans la DB UNIQUEMENT les assignations dont l'invitation a réussi
      if (successfulAssignments.length === 0) {
        const errorMessage = outlookErrors > 0
          ? `❌ Aucune invitation n'a pu être envoyée (${outlookErrors} erreur(s)).\n\nRaisons possibles :\n• Access token expiré\n• Adresse email invalide\n• Pas de connexion internet\n\nAucune assignation n'a été créée dans la base de données.`
          : `❌ Aucune invitation à envoyer.`;
        setSendingInvitations(false);
        alert(errorMessage);
        return;
      }

      console.log(`Création de ${successfulAssignments.length} assignations dans la DB...`);

      // Préparer les données pour la DB (sans outlookEventId d'abord)
      const dbAssignments = successfulAssignments.map(a => ({
        date: a.date,
        shiftId: a.shiftId,
        userId: a.userId,
        status: a.status
      }));

      // Créer les assignations dans la DB
      const response = await fetch('/api/shift-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: dbAssignments })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save assignments');
      }

      const result = await response.json();
      console.log(`${result.count} assignations créées dans la base de données`);

      // ÉTAPE 3 : Mettre à jour chaque assignation avec son outlookEventId
      for (const successfulAssignment of successfulAssignments) {
        const foundAssignment = result.assignments.find((a: any) => {
          const dateMatch = new Date(a.date).toDateString() === new Date(successfulAssignment.date).toDateString();
          const userMatch = a.userId === successfulAssignment.userId;
          const shiftMatch = a.shiftId === successfulAssignment.shiftId;
          return dateMatch && userMatch && shiftMatch;
        });

        if (foundAssignment) {
          await fetch(`/api/shift-assignments/${foundAssignment.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ outlookEventId: successfulAssignment.outlookEventId })
          });
        }
      }

      // Afficher le dialog de succès
      setSuccessMessage({
        outlookSuccess,
        outlookErrors,
        dbCount: result.count
      });
      setShowSuccessDialog(true);
      setSendingInvitations(false);

    } catch (error) {
      console.error('Error sending shift invitations:', error);
      setSendingInvitations(false);
      alert(`❌ ${t('errorSendingInvitations')}\n${error instanceof Error ? error.message : t('unknownError')}`);
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
          // Créer une copie profonde des assignations pour ce jour
          const dayAssignmentsCopy = assignments.map(a => ({...a}));
          setSelectedDayAssignments(dayAssignmentsCopy);
          setTempShiftAssignments([...shiftAssignments]); // Copie complète
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
          // Gestion améliorée des couleurs
          let color = '#dc2626'; // Rouge par défaut pour les piketts

          if (!assignment.isPikett) {
            // Pour les shifts normaux, utiliser la couleur du shift depuis la DB
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
                  <span className="text-slate-700 truncate text-xs">
                    : {assignment.assignedUsers[0].firstName} {assignment.assignedUsers[0].lastName}
                  </span>
                ) : (
                  <span className="text-orange-600 text-xs">: ⚠</span>
                )}
              </div>
            </div>
          );
        })}
        {hiddenCount > 0 && (
          <div className="text-xs text-slate-500 text-center font-medium">
            +{hiddenCount} autre{hiddenCount > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
};

  useEffect(() => {
    console.log('Page planner chargée');
    console.log('Utilisateurs DB:', users);
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

        {/* Configuration et Calendrier dans la même vue */}
        <div className={`grid grid-cols-1 gap-6 ${showConfiguration ? 'xl:grid-cols-4' : ''}`}>
          {/* Panneau de configuration à gauche */}
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

                  {shiftAssignments.length > 0 && (
                    <Button
                      onClick={sendShiftInvitations}
                      disabled={sendingInvitations}
                      className="w-full bg-[#00ff7b] text-black hover:bg-[#00ff7b]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sendingInvitations ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Envoi en cours...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          {t('sendInvitations')}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          )}

          {/* Calendrier et statistiques à droite */}
          <div className={`space-y-6 ${showConfiguration ? 'xl:col-span-3' : ''}`}>
            {/* Statistiques */}
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

            {/* Calendrier */}
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
                        // Pour les cellules vides, déterminer si c'est un weekend
                        const firstDay = getFirstDayOfMonth(calendarMonth, calendarYear);
                        const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
                        const dayOfWeek = (index % 7);
                        // 5 = samedi, 6 = dimanche (dans notre vue Lun-Dim)
                        if (dayOfWeek === 5 || dayOfWeek === 6) {
                          return null;
                        }
                      } else {
                        const date = new Date(calendarYear, calendarMonth, day);
                        const dayOfWeek = date.getDay();
                        // 0 = dimanche, 6 = samedi
                        if (dayOfWeek === 0 || dayOfWeek === 6) {
                          return null;
                        }
                      }
                    }
                    return <CalendarDay key={index} day={day} />;
                  })}
                </div>
                
                {/* Légende */}
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
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Grille compacte: Utilisateurs avec rotation + Out of Office */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Utilisateurs avec rotation */}
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

              {/* Utilisateurs Out of Office */}
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
                        // Créer une liste de paires (user, event) au lieu de grouper
                        const userEventPairs: Array<{ user: any; event: OutlookEvent }> = [];

                        outOfOfficeEvents.forEach((event: OutlookEvent) => {
                          const eventStart = new Date(event.start.dateTime);
                          const eventEnd = new Date(event.end.dateTime);
                          const periodStart = new Date(startDate);
                          const periodEnd = new Date(endDate);

                          if (eventStart <= periodEnd && eventEnd >= periodStart) {
                            const userEmail = event.organizer?.emailAddress?.address;
                            if (userEmail) {
                              const user = availableUsers.find(u => u.email?.toLowerCase() === userEmail.toLowerCase());
                              if (user) {
                                userEventPairs.push({ user, event });
                              }
                            }
                          }
                        });

                        // Trier par date de début
                        const sortedPairs = userEventPairs.sort((a, b) => {
                          const aStart = new Date(a.event.start.dateTime).getTime();
                          const bStart = new Date(b.event.start.dateTime).getTime();
                          return aStart - bStart;
                        });

                        if (sortedPairs.length === 0) {
                          return (
                            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                              <Calendar className="w-12 h-12 mb-2 opacity-50" />
                              <p className="text-sm">{t('noAbsenceForPeriod')}</p>
                            </div>
                          );
                        }

                        return sortedPairs.map(({ user, event }, index) => {
                          // Ajuster la date de fin pour les événements "toute la journée"
                          const startDate = new Date(event.start.dateTime);
                          const displayEndDate = event.isAllDay
                            ? new Date(new Date(event.end.dateTime).getTime() - 1000)
                            : new Date(event.end.dateTime);

                          // Vérifier si c'est un seul jour
                          const isSingleDay = startDate.toDateString() === displayEndDate.toDateString();

                          // Vérifier si les dates sont sur des années différentes
                          const isDifferentYear = startDate.getFullYear() !== displayEndDate.getFullYear();

                          // Format de date selon le contexte
                          const dateFormat = isDifferentYear
                            ? ({ day: 'numeric', month: 'short', year: 'numeric' } as const)
                            : ({ day: 'numeric', month: 'short' } as const);

                          const timeFormat = { hour: '2-digit', minute: '2-digit' } as const;

                          return (
                            <div key={`${user.id}-${index}`} className="flex items-center justify-between p-2.5 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg">
                              <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                                <Avatar className="w-8 h-8 flex-shrink-0">
                                  <AvatarFallback className="text-xs bg-gradient-to-br from-orange-500 to-amber-600 text-white">
                                    {user.firstName?.[0]}{user.lastName?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-slate-800 truncate">{user.firstName} {user.lastName}</p>
                                  <p className="text-xs text-slate-600 truncate">
                                    {event.subject || t('absence')}
                                  </p>
                                </div>
                              </div>
                              {isSingleDay ? (
                                <div className="flex flex-col items-end gap-0.5 flex-shrink-0 ml-2 px-2.5 py-1 bg-orange-100 rounded-md">
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-orange-600" />
                                    <span className="text-xs font-medium text-orange-700">
                                      {startDate.toLocaleDateString(locale, dateFormat)}
                                    </span>
                                  </div>
                                  {!event.isAllDay && (
                                    <span className="text-xs text-orange-600">
                                      {startDate.toLocaleTimeString(locale, timeFormat)} - {displayEndDate.toLocaleTimeString(locale, timeFormat)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2 px-3 py-1.5 bg-orange-100 rounded-md">
                                  <Calendar className="w-3.5 h-3.5 text-orange-600" />
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs font-medium text-orange-700 whitespace-nowrap">
                                      {startDate.toLocaleDateString(locale, dateFormat)}
                                      {!event.isAllDay && ` ${startDate.toLocaleTimeString(locale, timeFormat)}`}
                                    </span>
                                    <span className="text-xs text-orange-500">→</span>
                                    <span className="text-xs font-medium text-orange-700 whitespace-nowrap">
                                      {displayEndDate.toLocaleDateString(locale, dateFormat)}
                                      {!event.isAllDay && ` ${displayEndDate.toLocaleTimeString(locale, timeFormat)}`}
                                    </span>
                                  </div>
                                </div>
                              )}
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

        {/* Dialog détails jour améliorée */}
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
                    // Utiliser la couleur du shift depuis la DB
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
                                      
                                      {/* Utilisateurs éligibles */}
                                      <div className="py-2">
                                        <p className="px-2 text-xs font-semibold text-slate-600 mb-1">{t('available')}</p>
                                        {(() => {
                                        // Obtenir TOUS les shifts du jour pour cet utilisateur EN TEMPS RÉEL
                                        const getOtherShiftsForUser = (userId: string) => {
                                          const currentDayAssignments = selectedDayAssignments?.filter(a => 
                                            a.date === assignment.date && 
                                            a.assignedUsers.some(u => u.id === userId) &&
                                            a.shiftId !== assignment.shiftId
                                          ) || [];
                                          
                                          return currentDayAssignments;
                                        };
                                        
                                        // Utilisateurs éligibles pour ce pikett
                                        const eligibleUsers = assignment.isPikett 
                                          ? availableUsers.filter(u => {
                                              const pikett = piketts.find(p => p.id === assignment.shiftId);
                                              if (!pikett) return false;
                                              const inTeam = u.teamId === pikett.teamId;
                                              const included = (pikett as any).includedUserIds?.includes(u.id);
                                              const excluded = (pikett as any).excludedUserIds?.includes(u.id);
                                              const isEligible = (inTeam && !excluded) || included;
                                              // AJOUT: Vérifier si l'utilisateur travaille ce jour
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
                                              // AJOUT: Vérifier si l'utilisateur travaille ce jour
                                              const worksThisDay = isUserWorkingOnDay(u, assignment.date, shift.startTime);
                                              return isEligible && worksThisDay;
                                            });

                                        // Recalculer les unavailableUsers en temps réel
                                        // Pour les OOF, on doit recalculer avec les heures du shift
                                        const shift = shifts.find(s => s.id === assignment.shiftId);
                                        const pikett = piketts.find(p => p.id === assignment.shiftId);
                                        const currentShift = shift || pikett;

                                        // ===================================================
                                        // VÉRIFIER TOUTES LES CONTRAINTES POUR TOUS LES UTILISATEURS ÉLIGIBLES
                                        // ===================================================

                                        // Calcul des dates pour vérifier les shifts consécutifs
                                        const assignmentDate = new Date(assignment.date);
                                        const prevDate = new Date(assignmentDate);
                                        prevDate.setDate(prevDate.getDate() - 1);
                                        const nextDate = new Date(assignmentDate);
                                        nextDate.setDate(nextDate.getDate() + 1);
                                        const prevDateStr = prevDate.toISOString().split('T')[0];
                                        const nextDateStr = nextDate.toISOString().split('T')[0];

                                        // Catégoriser chaque utilisateur éligible
                                        const usersWithOtherShifts: any[] = [];
                                        const usersWithOOF: Array<{user: any; reason: string; conflictEvents: OutlookEvent[]}> = [];
                                        const usersWithConsecutiveShifts: Array<{user: any; reason: string; conflictEvents: OutlookEvent[]}> = [];
                                        const usersNotWorkingToday: Array<{user: any; reason: string; conflictEvents: OutlookEvent[]}> = [];
                                        const available: any[] = [];

                                        for (const user of eligibleUsers) {
                                          // Ne pas traiter l'utilisateur actuellement assigné
                                          if (assignment.assignedUsers.length > 0 &&
                                              assignment.assignedUsers[0].id === user.id) {
                                            continue;
                                          }

                                          // 1. Vérifier s'il est déjà assigné à un autre shift aujourd'hui
                                          const otherShifts = getOtherShiftsForUser(user.id);
                                          if (otherShifts.length > 0) {
                                            usersWithOtherShifts.push(user);
                                            continue;
                                          }

                                          // 2. Vérifier Out of Office
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

                                          // 3. Vérifier s'il ne travaille pas ce jour (déjà filtré dans eligibleUsers mais double check)
                                          const worksThisDay = isUserWorkingOnDay(user, assignment.date, shift?.startTime);
                                          if (!worksThisDay) {
                                            usersNotWorkingToday.push({
                                              user,
                                              reason: t('reasonNotWorkingToday'),
                                              conflictEvents: []
                                            });
                                            continue;
                                          }

                                          // 4. Vérifier shifts consécutifs
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

                                          // 5. Si aucune contrainte, l'utilisateur est disponible
                                          available.push(user);
                                        }

                                        // Combiner toutes les contraintes pour l'affichage
                                        const currentlyUnavailable = [
                                          ...usersWithOOF,
                                          ...usersWithConsecutiveShifts,
                                          ...usersNotWorkingToday
                                        ];

                                        return (
                                          <>
                                            {/* Utilisateurs disponibles */}
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
                                            
                                            {/* Utilisateurs déjà assignés à un autre shift ce jour */}
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
                                            
                                            {/* Utilisateurs avec contraintes originales (OOF, etc.) */}
                                            {/* Utilisateurs avec contraintes originales (OOF, etc.) */}
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

                        {/* Liste des personnes non disponibles */}
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
          
          {/* Boutons d'action fixes en bas */}
          <div className="border-t bg-white px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-500">
                      {(() => {
                        if (!selectedDayAssignments || selectedDayAssignments.length === 0) return 0;
                        const selectedDate = selectedDayAssignments[0]?.date;

                        // Compter les modifications manuelles dans tempShiftAssignments
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
                          // Ne rien sauvegarder, juste fermer
                          setSelectedDayAssignments(null);
                          setTempShiftAssignments([...shiftAssignments]); // Restaurer l'original
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
                          // Appliquer les modifications
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

        {/* Dialog de succès pour l'envoi des invitations */}
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
                {/* Statistiques d'envoi */}
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

                {/* Message d'erreur si présent */}
                {successMessage.outlookErrors > 0 && (
                  <Alert className="border-orange-200 bg-orange-50">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800">
                      {t('sendErrors', { count: successMessage.outlookErrors })}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Message d'information */}
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
                Compris
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