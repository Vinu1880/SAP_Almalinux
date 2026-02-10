'use client';

//app/users/page.tsx

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navigation from '@/components/Navigation';
import { useTranslations } from 'next-intl';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Search,
  Mail,
  Phone,
  Calendar,
  Clock,
  UserCheck,
  UserX,
  Download,
  Upload,
  Settings,
  Shield,
  Loader2,
  RefreshCw,
  AlertCircle,
  Save,
  X,
  Sun,
  Moon,
  CalendarDays,
  Building2,
  Crown,
  RotateCw,
  ChevronRight,
  Info,
  Palette,
  AlertTriangle,
  UserPlus,
  UserMinus,
  Grid3X3,
  List,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal
} from 'lucide-react';
import { useShifts } from '@/lib/hooks/useShifts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRotationPatterns } from '@/contexts/RotationPatternsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Import des hooks
import { useUsers } from '@/lib/hooks/useUsers';
import { useTeams } from '@/lib/hooks/useTeams';

// Types
type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'night';
type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

interface WeekPattern {
  [key: string]: string[];
}

interface RotationPattern {
  id: string;
  name: string;
  description?: string;
  weeks: WeekPattern[];
  cycleLength: number;
  userShifts?: string[];
}

interface RotationConfig {
  patternId: string;
  priority: 'high' | 'medium' | 'low';
  allowedShiftTypes: string[];
}

type DayAvailability = {
  morning: boolean;
  afternoon: boolean;
};

type WeekAvailability = {
  monday: DayAvailability;
  tuesday: DayAvailability;
  wednesday: DayAvailability;
  thursday: DayAvailability;
  friday: DayAvailability;
  saturday: DayAvailability;
  sunday: DayAvailability;
};

const fullTimeAvailability: WeekAvailability = {
  monday: { morning: true, afternoon: true },
  tuesday: { morning: true, afternoon: true },
  wednesday: { morning: true, afternoon: true },
  thursday: { morning: true, afternoon: true },
  friday: { morning: true, afternoon: true },
  saturday: { morning: false, afternoon: false },
  sunday: { morning: false, afternoon: false }
};

// Couleurs disponibles pour les équipes (10 couleurs distinctes)
const TEAM_COLORS = [
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

const SWISS_CANTONS = [
  { value: 'VD', label: 'Vaud (VD)' },
  { value: 'BE', label: 'Berne (BE)' },
  { value: 'ZH', label: 'Zurich (ZH)' }
];

// Ajout du style CSS pour l'animation de rotation
const rotationStyle = `
  @keyframes spin-slow {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  .animate-spin-slow {
    animation: spin-slow 3s linear infinite;
  }
`;

const UsersPage = () => {
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const [viewMode, setViewMode] = useState<'users' | 'teams'>('users');
  const [userViewType, setUserViewType] = useState<'grid' | 'list'>('grid');
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [isCreateTeamDialogOpen, setIsCreateTeamDialogOpen] = useState(false);
  const [isEditTeamDialogOpen, setIsEditTeamDialogOpen] = useState(false);
  const [isCreatePatternOpen, setIsCreatePatternOpen] = useState(false);
  const [editingPattern, setEditingPattern] = useState<RotationPattern | null>(null);
  const [savingPattern, setSavingPattern] = useState(false);
  const [deletePatternId, setDeletePatternId] = useState<string | null>(null);
  const [isDeletePatternDialogOpen, setIsDeletePatternDialogOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [isDeleteUserDialogOpen, setIsDeleteUserDialogOpen] = useState(false);
  const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null);
  const [isDeleteTeamDialogOpen, setIsDeleteTeamDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTeam, setFilterTeam] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'firstName' | 'team'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Helper function to get sort label
  const getSortLabel = () => {
    const arrow = sortOrder === 'asc' ? '↑' : '↓';
    const labels = {
      name: tCommon("name"),
      firstName: t("firstName"),
      team: tCommon("team")
    };
    return `${arrow} ${labels[sortBy]}`;
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [workType, setWorkType] = useState<'full' | 'partial'>('full');
  const [editWorkType, setEditWorkType] = useState<'full' | 'partial'>('full');
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { patterns: rotationPatterns, addPattern, updatePattern, deletePattern } = useRotationPatterns();
  const { shifts, loading: shiftsLoading } = useShifts();

  // Ajouter le style CSS
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = rotationStyle;
    document.head.appendChild(styleElement);
    return () => {
      if (document.head.contains(styleElement)) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);

  const [newPattern, setNewPattern] = useState<RotationPattern>({
    id: '',
    name: '',
    description: '',
    cycleLength: 2,
    weeks: [
      { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] },
      { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] }
    ],
    userShifts: []
  });

  const [newUser, setNewUser] = useState<any>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    location: '',
    teamId: '',
    role: '',
    workPercent: 100,
    notes: '',
    availability: fullTimeAvailability,
    rotationConfig: null as RotationConfig | null
  });

  const [newTeam, setNewTeam] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    leadId: ''
  });

  // Utilisation des hooks
  const { 
    users, 
    loading: usersLoading, 
    error: usersError, 
    createUser,
    updateUser,
    deleteUser,
    refetch: refetchUsers 
  } = useUsers();
  
  const { 
    teams, 
    loading: teamsLoading, 
    error: teamsError,
    createTeam,
    updateTeam,
    deleteTeam,
    refetch: refetchTeams 
  } = useTeams();

  // FONCTION DE VÉRIFICATION DE ROTATION - Version corrigée
  const hasValidRotation = (user: any): boolean => {
    console.log(`Checking rotation for ${user.firstName}:`, {
      rotationConfig: user.rotationConfig,
      type: typeof user.rotationConfig,
      hasPatternId: !!(user.rotationConfig?.patternId)
    });
    
    // Vérifier si l'objet rotationConfig existe et a un patternId valide
    return !!(user.rotationConfig && 
             typeof user.rotationConfig === 'object' && 
             user.rotationConfig.patternId &&
             user.rotationConfig.patternId !== '');
  };

  // FONCTION DE RÉCUPÉRATION DE LA CONFIG DE ROTATION
  const getRotationConfig = (user: any): RotationConfig | null => {
    if (!hasValidRotation(user)) return null;
    
    return {
      patternId: user.rotationConfig.patternId,
      priority: user.rotationConfig.priority || 'medium',
      allowedShiftTypes: user.rotationConfig.allowedShiftTypes || []
    };
  };

  // Fonctions utilitaires
  const showError = (message: string) => {
    setErrorMessage(message);
    setErrorDialogOpen(true);
  };

  const isValidEmail = (email: string): boolean => {
    // Validation de base pour l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const calculateWorkPercent = (availability: WeekAvailability | null | undefined): number => {
    if (!availability) return 100;
    
    let totalSlots = 0;
    let availableSlots = 0;
    const workDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    
    workDays.forEach((day) => {
      totalSlots += 2; // 2 créneaux par jour (matin + après-midi)
      const dayAvail = availability[day as keyof WeekAvailability];
      if (dayAvail?.morning) availableSlots++;
      if (dayAvail?.afternoon) availableSlots++;
    });
    
    // Si la personne travaille tous les créneaux du lundi au vendredi = 100%
    if (availableSlots === 10) return 100; // 5 jours × 2 créneaux = 10
    
    // Sinon calculer le pourcentage réel
    return Math.round((availableSlots / totalSlots) * 100);
  };

  const adjustCycleLength = (newLength: number) => {
    const updatedWeeks = [...newPattern.weeks];
    
    if (newLength > newPattern.cycleLength) {
      for (let i = newPattern.cycleLength; i < newLength; i++) {
        updatedWeeks.push({
          monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: []
        });
      }
    } else {
      updatedWeeks.splice(newLength);
    }
    
    setNewPattern({
      ...newPattern,
      cycleLength: newLength,
      weeks: updatedWeeks
    });
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge 
        variant={status === 'ACTIVE' ? 'default' : 'secondary'}
        className={status === 'ACTIVE' ? 'bg-green-100 text-green-800 border-0' : 'bg-slate-100 text-slate-600 border-0'}
      >
        {status === 'ACTIVE' ? t("active") : t("inactive")}
      </Badge>
    );
  };

  const getWorkPercentBadge = (percent: number) => {
    let colorClass = '';
    if (percent === 100) colorClass = 'bg-green-100 text-green-800';
    else if (percent >= 80) colorClass = 'bg-blue-100 text-blue-800';
    else colorClass = 'bg-orange-100 text-orange-800';
    
    return (
      <Badge className={`${colorClass} border-0`}>
        {percent}%
      </Badge>
    );
  };

  // Composant AvailabilityEditor RESTRUCTURÉ
  const AvailabilityEditor = ({ 
    availability, 
    onChange, 
    workType: localWorkType,
    onWorkTypeChange,
    rotationConfig,
    onRotationConfigChange,
    userId,
    isEditMode = false
  }: any) => {
    const days = [
      { key: 'monday', label: t("monday") },
      { key: 'tuesday', label: t("tuesday") },
      { key: 'wednesday', label: t("wednesday") },
      { key: 'thursday', label: t("thursday") },
      { key: 'friday', label: t("friday") },
      { key: 'saturday', label: t("saturday") },
      { key: 'sunday', label: t("sunday") }
    ];

    const handleDayChange = (day: string, period: 'morning' | 'afternoon', value: boolean) => {
      const newAvailability = { ...availability };
      newAvailability[day as keyof WeekAvailability][period] = value;
      onChange(newAvailability);
    };

    // Fonction pour vérifier si un jour est disponible (au moins un créneau)
    const isDayAvailable = (day: string) => {
      const dayAvail = availability[day as keyof WeekAvailability];
      return dayAvail?.morning || dayAvail?.afternoon;
    };

    // Fonction pour obtenir les shifts de l'utilisateur
    const getUserShifts = () => {
      if (!userId) return [];
      const user = users.find(u => u.id === userId);
      if (!user) return [];
       
      return shifts.filter((shift: any) => {
        const userInTeam = user.teamId === shift.teamId;
        const userIncluded = shift.includedUserIds?.includes(userId);
        const userExcluded = shift.excludedUserIds?.includes(userId);
        return (userInTeam && !userExcluded) || userIncluded;
      });
    };

    const getCurrentPattern = () => {
      if (!rotationConfig?.patternId) return null;
      return rotationPatterns.find(p => p.id === rotationConfig.patternId);
    };

    return (
      <div className="space-y-6">
        {/* Section Type de contrat */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-semibold">{t("contractType")}</Label>
            <p className="text-sm text-slate-600 mb-3">{t("defineDaysAndSlots")}</p>
          </div>
          
          <RadioGroup value={localWorkType} onValueChange={(value) => {
            onWorkTypeChange(value);
            
            // Si on passe en temps plein, mettre à jour automatiquement la disponibilité
            if (value === 'full') {
              onChange(fullTimeAvailability);
            }
          }}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="full" id={`full-${userId || 'new'}`} />
              <Label htmlFor={`full-${userId || 'new'}`} className="font-normal cursor-pointer">
                {t("fullTime")}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="partial" id={`partial-${userId || 'new'}`} />
              <Label htmlFor={`partial-${userId || 'new'}`} className="font-normal cursor-pointer">
                {t("partTime")}
              </Label>
            </div>
          </RadioGroup>

          {localWorkType === 'partial' && (
            <div className="border rounded-lg p-4 space-y-3 bg-slate-50">
              <p className="text-sm font-medium text-slate-700">{t("defineWorkSlots")}</p>
              {days.map(day => (
                <div key={day.key} className="flex items-center justify-between">
                  <span className="text-sm font-medium w-24">{day.label}</span>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={availability[day.key as keyof WeekAvailability].morning}
                        onCheckedChange={(checked) => 
                          handleDayChange(day.key, 'morning', checked as boolean)
                        }
                      />
                      <span className="text-sm flex items-center gap-1">
                        <Sun className="w-3 h-3" />
                        {t("morning")}
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={availability[day.key as keyof WeekAvailability].afternoon}
                        onCheckedChange={(checked) => 
                          handleDayChange(day.key, 'afternoon', checked as boolean)
                        }
                      />
                      <span className="text-sm flex items-center gap-1">
                        <Moon className="w-3 h-3" />
                        {t("afternoon")}
                      </span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section Rotation automatique - INDÉPENDANTE */}
        <div className="border-t pt-6">
          <div className="space-y-4">
            <div>
              <Label className="text-base font-semibold flex items-center">
                <RotateCw className="w-4 h-4 mr-2" />
                {t("automaticRotation")}
              </Label>
              <p className="text-sm text-slate-600 mb-3">
                {t("enableAutomaticRotationDesc")}
              </p>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
              <Checkbox
                id={`rotation-${userId || 'new'}`}
                checked={rotationConfig !== null && rotationConfig !== undefined}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onRotationConfigChange({
                      patternId: '',
                      priority: 'medium',
                      allowedShiftTypes: []
                    });
                  } else {
                    onRotationConfigChange(null);
                  }
                }}
              />
              <Label htmlFor={`rotation-${userId || 'new'}`} className="font-medium cursor-pointer">
                {t("enableRotationForUser")}
              </Label>
            </div>

            {rotationConfig !== null && rotationConfig !== undefined && (
              <div className="border rounded-lg p-4 space-y-4 bg-gradient-to-r from-purple-50 to-indigo-50">
                {/* Configuration de la rotation */}
                <div className="space-y-4">
                  <div>
                    <Label>{t("rotationPattern")}</Label>
                    <Select
                      value={rotationConfig?.patternId || ''}
                      onValueChange={(patternId) => {
                        setEditingPattern(null);
                        onRotationConfigChange({
                          ...rotationConfig,
                          patternId,
                          priority: rotationConfig?.priority || 'medium',
                          allowedShiftTypes: rotationConfig?.allowedShiftTypes || []
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("selectPattern")} />
                      </SelectTrigger>
                      <SelectContent>
                        {rotationPatterns.map(pattern => (
                          <SelectItem key={pattern.id} value={pattern.id}>
                            {pattern.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Liste des patterns existants avec suppression */}
                    <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm font-medium text-slate-700 mb-2">{t("existingPatterns")}</p>
                      {rotationPatterns.length > 0 ? (
                        <div className="space-y-2">
                          {rotationPatterns.map(pattern => (
                            <div key={pattern.id} className="flex items-center justify-between p-2 bg-white rounded border">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-slate-800">{pattern.name}</p>
                                {pattern.description && (
                                  <p className="text-xs text-slate-600">{pattern.description}</p>
                                )}
                                <p className="text-xs text-slate-500">
                                  {t("cycleOfWeeks", { count: pattern.cycleLength })}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setNewPattern({
                                      ...pattern,
                                      userShifts: (pattern as any).userShifts || []
                                    });
                                    setIsCreatePatternOpen(true);
                                  }}
                                  className="text-blue-600 hover:bg-blue-50"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setDeletePatternId(pattern.id);
                                    setIsDeletePatternDialogOpen(true);
                                  }}
                                  className="text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">{t("noPatternCreated")}</p>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Pré-remplir automatiquement avec les shifts de l'utilisateur en modification
                        if (userId && isEditMode) {
                          const userShifts = getUserShifts();
                          setNewPattern({
                            ...newPattern,
                            userShifts: userShifts.map((s: any) => s.id),
                            name: `Pattern ${selectedUser?.firstName || ''} ${selectedUser?.lastName || ''}`.trim()
                          });
                        }
                        setIsCreatePatternOpen(true);
                      }}
                      className="w-full mt-2 hover:bg-secondary/20"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      {t("createNewPattern")}
                    </Button>
                  </div>

                  <div>
                    <Label>{t("assignmentPriority")}</Label>
                    <RadioGroup
                      value={rotationConfig?.priority || 'medium'}
                      onValueChange={(value) => {
                        onRotationConfigChange({
                          ...rotationConfig,
                          patternId: rotationConfig?.patternId || '',
                          priority: value as 'high' | 'medium' | 'low',
                          allowedShiftTypes: rotationConfig?.allowedShiftTypes || []
                        });
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="high" id="high" />
                        <Label htmlFor="high" className="font-normal">{t("priorityHighDesc")}</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="medium" id="medium" />
                        <Label htmlFor="medium" className="font-normal">{t("priorityMediumDesc")}</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="low" id="low" />
                        <Label htmlFor="low" className="font-normal">{t("priorityLowDesc")}</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Afficher et éditer le pattern actuel si sélectionné */}
                  {getCurrentPattern() && (() => {
                    const currentPat = getCurrentPattern()!;
                    const userShifts = getUserShifts();
                    const isInlineEditing = isEditMode && editingPattern && editingPattern.id === currentPat.id;

                    return (
                      <div className="p-3 bg-white rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-slate-700">
                            {t("currentPattern")} {currentPat.name}
                          </p>
                          {isEditMode && !isInlineEditing && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingPattern({
                                ...currentPat,
                                userShifts: (currentPat as any).userShifts || userShifts.map((s: any) => s.id)
                              })}
                              className="text-blue-600 hover:bg-blue-50 text-xs"
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              {tCommon("edit")}
                            </Button>
                          )}
                          {isInlineEditing && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingPattern(null)}
                              className="text-slate-500 hover:bg-slate-100 text-xs"
                            >
                              <X className="w-3 h-3 mr-1" />
                              {tCommon("cancel")}
                            </Button>
                          )}
                        </div>

                        {isInlineEditing && editingPattern ? (
                          <div className="space-y-3">
                            {editingPattern.weeks.map((week: any, weekIndex: number) => (
                              <div key={weekIndex} className="border rounded-lg p-2">
                                <p className="text-xs font-semibold mb-2 text-purple-700">
                                  {t("weekXOfY", { week: weekIndex + 1, total: editingPattern.cycleLength })}
                                </p>
                                <div className="grid grid-cols-7 gap-1">
                                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                                    const dayLabel = day.substring(0, 3).toUpperCase();
                                    const dayAvailable = isDayAvailable(day);

                                    return (
                                      <div key={day} className="text-center">
                                        <p className="text-xs font-medium text-slate-600 mb-1">{dayLabel}</p>
                                        <Select
                                          value={week[day]?.[0] || 'none'}
                                          onValueChange={(shiftId) => {
                                            const updatedWeeks = [...editingPattern.weeks];
                                            updatedWeeks[weekIndex] = { ...updatedWeeks[weekIndex] };
                                            if (shiftId === 'none') {
                                              updatedWeeks[weekIndex][day] = [];
                                            } else {
                                              updatedWeeks[weekIndex][day] = [shiftId];
                                            }
                                            setEditingPattern({ ...editingPattern, weeks: updatedWeeks });
                                          }}
                                          disabled={!dayAvailable}
                                        >
                                          <SelectTrigger className={`w-full h-auto text-xs py-1 ${
                                            !dayAvailable ? 'opacity-50 bg-slate-100' : ''
                                          }`}>
                                            <SelectValue>
                                              {!dayAvailable ? (
                                                <span className="text-slate-400">{t("unavailableShort")}</span>
                                              ) : week[day]?.[0] ? (
                                                <span className="truncate">
                                                  {shifts.find((s: any) => s.id === week[day][0])?.name || 'Shift'}
                                                </span>
                                              ) : (
                                                <span className="text-slate-400">{t("free")}</span>
                                              )}
                                            </SelectValue>
                                          </SelectTrigger>
                                          {dayAvailable && (
                                            <SelectContent>
                                              <SelectItem value="none">
                                                <span className="text-slate-400">{t("free")}</span>
                                              </SelectItem>
                                              {userShifts.map((shift: any) => (
                                                <SelectItem key={shift.id} value={shift.id}>
                                                  <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: shift.color }} />
                                                    <span>{shift.name}</span>
                                                    <span className="text-xs text-slate-500">({shift.startTime}-{shift.endTime})</span>
                                                  </div>
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          )}
                                        </Select>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                            <Button
                              type="button"
                              size="sm"
                              disabled={savingPattern}
                              onClick={async () => {
                                try {
                                  setSavingPattern(true);
                                  await updatePattern({
                                    ...editingPattern,
                                    userShifts: editingPattern.userShifts || []
                                  } as any);
                                  setEditingPattern(null);
                                } catch (err) {
                                  console.error('Error updating pattern:', err);
                                } finally {
                                  setSavingPattern(false);
                                }
                              }}
                              className="w-full bg-[#00ff7b] text-black hover:bg-secondary/90"
                            >
                              {savingPattern ? (
                                <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> {t("saving") || tCommon("save")}</>
                              ) : (
                                <><Save className="w-3 h-3 mr-1" /> {t("savePatternChanges") || tCommon("save")}</>
                              )}
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {currentPat.weeks.map((week: any, weekIndex: number) => (
                              <div key={weekIndex} className="border rounded-lg p-2">
                                <p className="text-xs font-semibold mb-2 text-purple-700">
                                  {t("weekXOfY", { week: weekIndex + 1, total: currentPat.cycleLength })}
                                </p>
                                <div className="grid grid-cols-7 gap-1">
                                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                                    const shiftId = week[day]?.[0];
                                    const shift = shiftId ? shifts.find((s: any) => s.id === shiftId) : null;
                                    const dayLabel = day.substring(0, 3).toUpperCase();
                                    const dayAvailable = isDayAvailable(day);

                                    return (
                                      <div key={day} className="text-center">
                                        <p className="text-xs font-medium text-slate-600 mb-1">{dayLabel}</p>
                                        <div className={`p-2 rounded border min-h-[60px] flex flex-col justify-center ${
                                          !dayAvailable ? 'bg-slate-100 opacity-50' :
                                          shift ? 'bg-white' : 'bg-slate-50'
                                        }`}>
                                          {!dayAvailable ? (
                                            <p className="text-xs text-slate-400 italic">{t("unavailableShort")}</p>
                                          ) : shift ? (
                                            <>
                                              <div
                                                className="w-full h-1 rounded mb-1"
                                                style={{ backgroundColor: shift.color }}
                                              />
                                              <p className="text-xs font-medium truncate" title={shift.name}>
                                                {shift.name}
                                              </p>
                                              <p className="text-xs text-slate-500">
                                                {shift.startTime}-{shift.endTime}
                                              </p>
                                            </>
                                          ) : (
                                            <p className="text-xs text-slate-400 italic">{t("free")}</p>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Composant pour gérer les membres d'une équipe (similaire à MembersSelector des shifts)
  const TeamMembersSelector = ({
    teamId,
    currentMembers,
    onMembersChange
  }: {
    teamId: string,
    currentMembers: string[],
    onMembersChange: (memberIds: string[]) => void
  }) => {
    // Utilisateurs déjà dans cette équipe
    const teamUsers = users.filter(u => currentMembers.includes(u.id));

    // {t("availableUsers")} (pas dans cette équipe ET actifs)
    const availableUsers = users.filter(u =>
      !currentMembers.includes(u.id) &&
      u.status === 'ACTIVE'
    );

    const handleRemoveFromTeam = (userId: string) => {
      onMembersChange(currentMembers.filter(id => id !== userId));
    };

    const handleAddToTeam = (userId: string) => {
      onMembersChange([...currentMembers, userId]);
    };

    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">{t("teamMembers")}</Label>
            <Badge variant="outline" className="text-xs">
              {teamUsers.length}
            </Badge>
          </div>
          <div className="border rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto bg-green-50/30">
            {teamUsers.length > 0 ? (
              teamUsers.map(user => (
                <div key={user.id} className="flex items-center justify-between p-2 hover:bg-white/60 rounded">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs">
                        {user.firstName[0]}{user.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{user.firstName} {user.lastName}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-slate-500">{user.role || t("noRole")}</p>
                        {user.workPercent && user.workPercent < 100 && (
                          <Badge variant="outline" className="text-xs">
                            {user.workPercent}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => handleRemoveFromTeam(user.id)}
                  >
                    <UserMinus className="w-3 h-3" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">
                {t("noMembersInTeam")}
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">{t("availableUsers")}</Label>
            <Badge variant="outline" className="text-xs">
              {availableUsers.length}
            </Badge>
          </div>
          <div className="border rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
            {availableUsers.length > 0 ? (
              availableUsers.map(user => (
                <div key={user.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs">
                        {user.firstName[0]}{user.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{user.firstName} {user.lastName}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-slate-500">
                          {user.team?.name || tCommon("noTeam")}
                        </p>
                        {user.workPercent && user.workPercent < 100 && (
                          <Badge variant="outline" className="text-xs">
                            {user.workPercent}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-green-600 hover:bg-green-50"
                    onClick={() => handleAddToTeam(user.id)}
                  >
                    <UserPlus className="w-3 h-3" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">
                {t("allUsersAssigned")}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const handleCreateUser = async () => {
    if (!newUser.firstName || !newUser.lastName || !newUser.email) {
      showError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (!isValidEmail(newUser.email)) {
      showError('Veuillez entrer une adresse email valide (ex: nom@example.com)');
      return;
    }

    setIsSubmitting(true);
    try {
      const userData: any = {
        ...newUser,
        location: newUser.location || undefined,
        teamId: newUser.teamId || undefined,
        workPercent: calculateWorkPercent(newUser.availability),
        status: 'ACTIVE'
      };

      // Ajouter la configuration de rotation si applicable
      if (newUser.rotationConfig?.patternId) {
        userData.rotationConfig = newUser.rotationConfig;
        console.log('Frontend: Creating user with rotation config:', userData.rotationConfig);
      } else {
        userData.rotationConfig = null;
      }

      await createUser(userData);

      setIsCreateUserDialogOpen(false);
      setNewUser({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        location: '',
        teamId: '',
        role: '',
        workPercent: 100,
        notes: '',
        availability: fullTimeAvailability,
        rotationConfig: null
      });
      setWorkType('full');
    } catch (error: any) {
      console.error('Erreur lors de la création:', error);

      // Afficher le message d'erreur spécifique de l'API
      if (error.response?.data?.error) {
        showError(error.response.data.error);
      } else if (error.message) {
        showError(error.message);
      } else {
        showError('Erreur lors de la création de l\'utilisateur');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    if (!selectedUser.firstName || !selectedUser.lastName || !selectedUser.email) {
      showError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (!isValidEmail(selectedUser.email)) {
      showError('Veuillez entrer une adresse email valide (ex: nom@example.com)');
      return;
    }

    setIsSubmitting(true);
    try {
      const userData: any = {
        firstName: selectedUser.firstName,
        lastName: selectedUser.lastName,
        email: selectedUser.email,
        phone: selectedUser.phone || undefined,
        location: selectedUser.location || undefined,
        teamId: selectedUser.teamId || undefined,
        role: selectedUser.role || undefined,
        workPercent: calculateWorkPercent(selectedUser.availability),
        notes: selectedUser.notes || undefined,
        status: selectedUser.status,
        availability: selectedUser.availability
      };

      // Ajouter ou supprimer la configuration de rotation
      if (selectedUser.rotationConfig?.patternId) {
        userData.rotationConfig = selectedUser.rotationConfig;
        console.log('Frontend: Updating user with rotation config:', userData.rotationConfig);
      } else {
        userData.rotationConfig = null;
      }

      await updateUser(selectedUser.id, userData);

      setIsEditUserDialogOpen(false);
      setSelectedUser(null);
      setEditWorkType('full');
    } catch (error: any) {
      console.error('Erreur lors de la modification:', error);

      // Afficher le message d'erreur spécifique de l'API
      if (error.response?.data?.error) {
        showError(error.response.data.error);
      } else if (error.message) {
        showError(error.message);
      } else {
        showError('Erreur lors de la modification de l\'utilisateur');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;

    try {
      await deleteUser(deleteUserId);
      setIsDeleteUserDialogOpen(false);
      setDeleteUserId(null);
    } catch (error) {
      console.error('Erreur:', error);
      showError('Erreur lors de la suppression de l\'utilisateur');
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeam.name) {
      showError('Le nom est obligatoire');
      return;
    }

    setIsSubmitting(true);
    try {
      await createTeam(newTeam);
      setIsCreateTeamDialogOpen(false);
      setNewTeam({
        name: '',
        description: '',
        color: '#3b82f6',
        leadId: ''
      });
      refetchTeams();
    } catch (error) {
      console.error('Erreur:', error);
      showError('Erreur lors de la création de l\'équipe');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTeam = async () => {
    if (!selectedTeam) return;

    setIsSubmitting(true);
    try {
      const updateData = {
        name: selectedTeam.name,
        description: selectedTeam.description || null,
        color: selectedTeam.color,
        leadId: (selectedTeam.leadId === 'none' || !selectedTeam.leadId) ? null : selectedTeam.leadId,
        memberIds: selectedTeam.memberIds || []
      };

      await updateTeam(selectedTeam.id, updateData);

      // Rafraîchir les utilisateurs pour voir les changements d'équipe
      await refetchUsers();
      await refetchTeams();

      setIsEditTeamDialogOpen(false);
      setSelectedTeam(null);
    } catch (error) {
      console.error('Erreur:', error);
      showError('Erreur lors de la modification de l\'équipe');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!deleteTeamId) return;

    try {
      await deleteTeam(deleteTeamId);
      refetchTeams();
      setIsDeleteTeamDialogOpen(false);
      setDeleteTeamId(null);
    } catch (error) {
      console.error('Erreur:', error);
      showError('Erreur lors de la suppression de l\'équipe');
    }
  };

  // Filtrage et tri
  const filteredUsers = users
    .filter(user => {
      const matchesSearch = user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          user.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          user.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTeam = filterTeam === 'all' || user.teamId === filterTeam;
      const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
      return matchesSearch && matchesTeam && matchesStatus;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'name') {
        const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
        const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
        comparison = nameA.localeCompare(nameB);
      } else if (sortBy === 'firstName') {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
        comparison = nameA.localeCompare(nameB);
      } else if (sortBy === 'team') {
        comparison = (a.team?.name || 'ZZZ').localeCompare(b.team?.name || 'ZZZ');
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const filteredTeams = teams.filter(team => {
    const matchesSearch = team.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Constantes pour l'éditeur de pattern
  const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayLabels = {
    monday: 'Lun',
    tuesday: 'Mar',
    wednesday: 'Mer',
    thursday: 'Jeu',
    friday: 'Ven',
    saturday: 'Sam',
    sunday: 'Dim'
  };

  if (usersLoading || teamsLoading || shiftsLoading) {
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
            <h1 className="text-3xl font-bold text-slate-800">{t("title")}</h1>
          </div>
        </div>

        {/* Switcher Users/Teams + Create button */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-4">
            <Button
              variant={viewMode === 'users' ? 'default' : 'outline'}
              onClick={() => setViewMode('users')}
              className={viewMode === 'users' ? 'bg-primary hover:bg-primary/90' : 'hover:bg-secondary/20'}
              size="lg"
            >
              <Users className="w-5 h-5 mr-2" />
              {t("users")}
              <Badge variant="secondary" className="ml-2">
                {users.length}
              </Badge>
            </Button>
            <Button
              variant={viewMode === 'teams' ? 'default' : 'outline'}
              onClick={() => setViewMode('teams')}
              className={viewMode === 'teams' ? 'bg-primary hover:bg-primary/90' : 'hover:bg-secondary/20'}
              size="lg"
            >
              <Building2 className="w-5 h-5 mr-2" />
              {t("teams")}
              <Badge variant="secondary" className="ml-2">
                {teams.length}
              </Badge>
            </Button>
          </div>

          {viewMode === 'users' ? (
            <Button className="bg-primary hover:bg-primary/90" onClick={() => setIsCreateUserDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t("createUser")}
            </Button>
          ) : (
            <Button className="bg-primary hover:bg-primary/90" onClick={() => setIsCreateTeamDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t("createTeam")}
            </Button>
          )}
        </div>

        {/* Barre de filtres et actions */}
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder={tCommon("search") + "..."}
                    className="pl-9 w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                {viewMode === 'users' && (
                  <>
                    <Select value={filterTeam} onValueChange={setFilterTeam}>
                      <SelectTrigger className="w-auto">
                        <Building2 className="w-4 h-4 mr-2 text-slate-500" />
                        <SelectValue placeholder={t("team")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-400 to-purple-400"></div>
                            <span>{tCommon("allTeams")}</span>
                          </div>
                        </SelectItem>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color }}></div>
                              <span>{team.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-auto">
                        <Filter className="w-4 h-4 mr-2 text-slate-500" />
                        <SelectValue placeholder={t("status")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-gradient-to-r from-green-400 to-blue-400"></div>
                            <span>{tCommon("all")}</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="ACTIVE">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span>{t("active")}</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="INACTIVE">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                            <span>{t("inactive")}</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={`${sortBy}-${sortOrder}`}
                      onValueChange={(value) => {
                        const [field, order] = value.split('-');
                        setSortBy(field as 'name' | 'firstName' | 'team');
                        setSortOrder(order as 'asc' | 'desc');
                      }}
                    >
                      <SelectTrigger className="w-auto">
                        <ArrowUpDown className="w-4 h-4 mr-2" />
                        <span className="text-sm">{getSortLabel()}</span>
                      </SelectTrigger>
                      <SelectContent className="z-50">
                        <SelectItem value="name-asc">
                          <div className="flex items-center gap-2">
                            <ArrowUp className="w-4 h-4 text-blue-600" />
                            <span>{tCommon("name")}</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="name-desc">
                          <div className="flex items-center gap-2">
                            <ArrowDown className="w-4 h-4 text-orange-600" />
                            <span>{tCommon("name")}</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="firstName-asc">
                          <div className="flex items-center gap-2">
                            <ArrowUp className="w-4 h-4 text-blue-600" />
                            <span>{t("firstName")}</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="firstName-desc">
                          <div className="flex items-center gap-2">
                            <ArrowDown className="w-4 h-4 text-orange-600" />
                            <span>{t("firstName")}</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="team-asc">
                          <div className="flex items-center gap-2">
                            <ArrowUp className="w-4 h-4 text-blue-600" />
                            <span>{tCommon("team")}</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="team-desc">
                          <div className="flex items-center gap-2">
                            <ArrowDown className="w-4 h-4 text-orange-600" />
                            <span>{tCommon("team")}</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
              
              <div className="flex items-center space-x-3">
                {viewMode === 'users' && (
                  <>
                    <div className="flex items-center border rounded-lg">
                      <Button
                        variant={userViewType === 'grid' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setUserViewType('grid')}
                        className={userViewType === 'grid' ? 'rounded-r-none' : 'rounded-r-none hover:bg-secondary/20'}
                      >
                        <Grid3X3 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={userViewType === 'list' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setUserViewType('list')}
                        className={userViewType === 'list' ? 'rounded-l-none' : 'rounded-l-none hover:bg-secondary/20'}
                      >
                        <List className="w-4 h-4" />
                      </Button>
                    </div>
                    <span className="text-sm text-slate-600">
                      {filteredUsers.length} {filteredUsers.length > 1 ? t("users") : t("user")}
                    </span>
                  </>
                )}
                
                {viewMode === 'users' ? (
                  <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
                    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{t("createUser")}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>{t("firstName")} *</Label>
                            <Input
                              value={newUser.firstName}
                              onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                            />
                          </div>
                          <div>
                            <Label>{t("lastName")} *</Label>
                            <Input
                              value={newUser.lastName}
                              onChange={(e) => setNewUser({...newUser, lastName: e.target.value})}
                            />
                          </div>
                        </div>
                        
                        <div>
                          <Label>Email *</Label>
                          <Input
                            type="email"
                            value={newUser.email}
                            onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>{t("phone")}</Label>
                            <Input
                              type="tel"
                              placeholder="+41 XX XXX XX XX"
                              value={newUser.phone}
                              onChange={(e) => setNewUser({...newUser, phone: e.target.value})}
                            />
                          </div>
                          <div>
                          <Label>{t("location")}</Label>
                          <Select 
                            value={newUser.location || 'none'} 
                            onValueChange={(value) => setNewUser({...newUser, location: value === 'none' ? '' : value})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t("selectCanton")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">{t("notSpecified")}</SelectItem>
                              {SWISS_CANTONS.map((canton) => (
                                <SelectItem key={canton.value} value={canton.value}>
                                  {canton.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>{tCommon("team")}</Label>
                            <Select 
                              value={newUser.teamId || 'none'} 
                              onValueChange={(value) => setNewUser({...newUser, teamId: value === 'none' ? '' : value})}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={tCommon("select")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">{tCommon("none")}</SelectItem>
                                {teams.map((team) => (
                                  <SelectItem key={team.id} value={team.id}>
                                    {team.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <AvailabilityEditor
                          availability={newUser.availability}
                          onChange={(newAvailability: WeekAvailability) => setNewUser({...newUser, availability: newAvailability})}
                          workType={workType}
                          onWorkTypeChange={(type: string) => {
                            setWorkType(type as 'full' | 'partial');
                          }}
                          rotationConfig={newUser.rotationConfig}
                          onRotationConfigChange={(config: RotationConfig | null) => setNewUser({...newUser, rotationConfig: config})}
                        />
                        
                        <div className="flex justify-end space-x-3">
                          <Button variant="outline" onClick={() => setIsCreateUserDialogOpen(false)} className="hover:bg-secondary/20">
                            {tCommon("cancel")}
                          </Button>
                          <Button
                            onClick={handleCreateUser}
                            disabled={isSubmitting}
                            className="bg-primary hover:bg-primary/90"
                          >
                            {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("creating")}</> : tCommon("create")}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Dialog open={isCreateTeamDialogOpen} onOpenChange={setIsCreateTeamDialogOpen}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("createTeam")}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label>{t("teamName")} *</Label>
                          <Input
                            placeholder="ex: IT Support"
                            value={newTeam.name}
                            onChange={(e) => setNewTeam({...newTeam, name: e.target.value})}
                          />
                        </div>
                        
                        <div>
                          <Label>{t("teamColor")}</Label>
                          <div className="flex items-center space-x-2 mt-2">
                            {TEAM_COLORS.map((color) => (
                              <button
                                key={color}
                                type="button"
                                className={`w-8 h-8 rounded-lg border-2 ${
                                  newTeam.color === color ? 'border-slate-800' : 'border-slate-200'
                                }`}
                                style={{ backgroundColor: color }}
                                onClick={() => setNewTeam({...newTeam, color})}
                              />
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <Label>{t("teamLead")}</Label>
                          <Select
                            value={newTeam.leadId || 'none'}
                            onValueChange={(value) => setNewTeam({...newTeam, leadId: value === 'none' ? '' : value})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={tCommon("select")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">{tCommon("none")}</SelectItem>
                              {users.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.firstName} {user.lastName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex justify-end space-x-3">
                          <Button variant="outline" onClick={() => setIsCreateTeamDialogOpen(false)} className="hover:bg-secondary/20">
                            {tCommon("cancel")}
                          </Button>
                          <Button
                            onClick={handleCreateTeam}
                            disabled={isSubmitting}
                            className="bg-primary hover:bg-primary/90"
                          >
                            {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("creating")}</> : tCommon("create")}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vue Utilisateurs */}
        {viewMode === 'users' && (
          <>
            {userViewType === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {filteredUsers.map((user) => {
                  const hasRotation = hasValidRotation(user);
                  const rotationConfig = getRotationConfig(user);
                  const rotationPattern = hasRotation && rotationConfig ? rotationPatterns.find(p => p.id === rotationConfig.patternId) : null;
                  
                  return (
                    <Card key={user.id} className="bg-white border-0 shadow-sm hover:shadow-md transition-all relative">
                      {/* INDICATEUR DE ROTATION TRÈS VISIBLE */}
                      {hasRotation && (
                        <div className="absolute -top-2 -right-2 z-10">
                          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full p-2 shadow-lg">
                            <RotateCw className="w-5 h-5 text-white animate-spin-slow" />
                          </div>
                        </div>
                      )}
                      
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <Avatar className="w-10 h-10">
                              <AvatarFallback className="bg-gradient-to-br from-slate-600 to-slate-700 text-white text-sm">
                                {user.firstName[0]}{user.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <h4 className="font-semibold text-slate-800">
                                {user.firstName} {user.lastName}
                              </h4>
                              <p className="text-xs text-slate-600">{user.role}</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2 text-xs">
                            <Mail className="w-3 h-3 text-slate-500" />
                            <span className="text-slate-600 truncate">{user.email}</span>
                          </div>
                          {user.phone && (
                            <div className="flex items-center space-x-2 text-xs">
                              <Phone className="w-3 h-3 text-slate-500" />
                              <span className="text-slate-600">{user.phone}</span>
                            </div>)}
                          {user.location && (
                            <div className="flex items-center space-x-2 text-xs">
                              <Building2 className="w-3 h-3 text-slate-500" />
                              <span className="text-slate-600">
                                {user.location}
                              </span>
                            </div>
                          )}
                        </div>

                        {hasRotation && rotationPattern && (
                          <div className="mt-3 p-2 bg-purple-50 rounded-lg border border-purple-200">
                            <p className="text-xs font-semibold text-purple-700 flex items-center">
                              <RotateCw className="w-3 h-3 mr-1" />
                              {rotationPattern.name}
                            </p>
                            <p className="text-xs text-purple-600 mt-1">
                              {t("priority")}: {rotationConfig?.priority === 'high' ? t("priorityHigh") :
                                        rotationConfig?.priority === 'medium' ? t("priorityMedium") : t("priorityLow")}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-3 pt-3 border-t">
                          <div className="flex items-center gap-2">
                            {user.team && (
                              <Badge
                                variant="outline"
                                className="text-xs border"
                                style={{
                                  backgroundColor: user.team.color ? `${user.team.color}15` : undefined,
                                  borderColor: user.team.color ? `${user.team.color}40` : undefined,
                                  color: user.team.color || undefined,
                                }}
                              >
                                {user.team.color && (
                                  <span className="w-2 h-2 rounded-full mr-1 inline-block" style={{ backgroundColor: user.team.color }}></span>
                                )}
                                {user.team.name}
                              </Badge>
                            )}
                            {getWorkPercentBadge(user.workPercent || 100)}
                          </div>
                          {getStatusBadge(user.status)}
                        </div>

                        <div className="flex items-center justify-between pt-3 mt-3 border-t">
                          <Button
                            onClick={() => {
                              let userWorkType: 'full' | 'partial' = 'full';

                              if (user.workPercent && user.workPercent < 100) {
                                userWorkType = 'partial';
                              }

                              setEditWorkType(userWorkType);

                              setSelectedUser({
                                id: user.id,
                                firstName: user.firstName || '',
                                lastName: user.lastName || '',
                                email: user.email || '',
                                phone: user.phone || '',
                                location: user.location || '',
                                teamId: user.teamId || '',
                                role: user.role || '',
                                workPercent: user.workPercent || 100,
                                status: user.status || 'ACTIVE',
                                notes: user.notes || '',
                                availability: user.availability || fullTimeAvailability,
                                rotationConfig: getRotationConfig(user)
                              });

                              setIsEditUserDialogOpen(true);
                            }}
                            variant="outline"
                            size="sm"
                            className="flex-1 mr-2 hover:bg-secondary/20"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            {tCommon("edit")}
                          </Button>
                          <Button
                            onClick={() => {
                              setDeleteUserId(user.id);
                              setIsDeleteUserDialogOpen(true);
                            }}
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="bg-white border-0 shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("name")}</TableHead>
                      <TableHead>{t("email")}</TableHead>
                      <TableHead>{t("location")}</TableHead>
                      <TableHead>{t("team")}</TableHead>
                      <TableHead>{t("role")}</TableHead>
                      <TableHead>{t("work")}</TableHead>
                      <TableHead>{t("rotation")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead className="text-right">{tCommon("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => {
                      const hasRotation = hasValidRotation(user);
                      const rotationConfig = getRotationConfig(user);
                      const rotationPattern = hasRotation && rotationConfig ? rotationPatterns.find(p => p.id === rotationConfig.patternId) : null;
                      
                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className="text-xs">
                                  {user.firstName[0]}{user.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{user.firstName} {user.lastName}</p>
                              </div>
                              {hasRotation && (
                                <RotateCw className="w-4 h-4 text-purple-600 animate-spin-slow" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{user.email}</TableCell>
                          <TableCell>
                            {user.location ? (
                              <span className="text-xs text-slate-600 flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {user.location}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.team && (
                              <Badge
                                variant="outline"
                                className="text-xs border"
                                style={{
                                  backgroundColor: user.team.color ? `${user.team.color}15` : undefined,
                                  borderColor: user.team.color ? `${user.team.color}40` : undefined,
                                  color: user.team.color || undefined,
                                }}
                              >
                                {user.team.color && (
                                  <span className="w-2 h-2 rounded-full mr-1 inline-block" style={{ backgroundColor: user.team.color }}></span>
                                )}
                                {user.team.name}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{user.role}</TableCell>
                          <TableCell>
                            {getWorkPercentBadge(user.workPercent || 100)}
                          </TableCell>
                          <TableCell>
                            {hasRotation ? (
                              <div className="flex items-center gap-1">
                                <Badge className="bg-purple-100 text-purple-700 border-0 text-xs">
                                  <RotateCw className="w-3 h-3 mr-1" />
                                  {rotationPattern?.name || 'Rotation'}
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(user.status)}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="hover:bg-secondary/20">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    let userWorkType: 'full' | 'partial' = 'full';

                                    if (user.workPercent && user.workPercent < 100) {
                                      userWorkType = 'partial';
                                    }

                                    setEditWorkType(userWorkType);

                                    setSelectedUser({
                                      id: user.id,
                                      firstName: user.firstName || '',
                                      lastName: user.lastName || '',
                                      email: user.email || '',
                                      phone: user.phone || '',
                                      location: user.location || '',
                                      teamId: user.teamId || '',
                                      role: user.role || '',
                                      workPercent: user.workPercent || 100,
                                      status: user.status || 'ACTIVE',
                                      notes: user.notes || '',
                                      availability: user.availability || fullTimeAvailability,
                                      rotationConfig: getRotationConfig(user)
                                    });

                                    setIsEditUserDialogOpen(true);
                                  }}
                                >
                                  <Edit className="w-4 h-4 mr-2" />
                                  {tCommon("edit")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setDeleteUserId(user.id);
                                    setIsDeleteUserDialogOpen(true);
                                  }}
                                  variant="destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  {tCommon("delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </>
        )}

        {/* Vue Équipes */}
        {viewMode === 'teams' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {filteredTeams.map((team) => {
              const teamMembers = users.filter(u => u.teamId === team.id);
              const lead = team.leadId ? users.find(u => u.id === team.leadId) : null;
              const activeMembers = teamMembers.filter(u => u.status === 'ACTIVE');
              const rotationMembers = teamMembers.filter(u => hasValidRotation(u));
              
              return (
                <Card key={team.id} className="bg-white border-0 shadow-sm hover:shadow-md transition-all">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow"
                          style={{ backgroundColor: team.color }}
                        >
                          {team.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <CardTitle className="text-lg font-bold text-slate-800">
                            {team.name}
                          </CardTitle>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        <Users className="w-3 h-3 mr-1" />
                        {teamMembers.length}
                      </Badge>
                      {activeMembers.length !== teamMembers.length && (
                        <Badge variant="outline" className="text-xs bg-green-50">
                          <UserCheck className="w-3 h-3 mr-1" />
                          {activeMembers.length} {activeMembers.length > 1 ? t("activeMembers") : t("activeMember")}
                        </Badge>
                      )}
                      {rotationMembers.length > 0 && (
                        <Badge className="bg-purple-100 text-purple-800 text-xs border-0">
                          <RotateCw className="w-3 h-3 mr-1" />
                          {rotationMembers.length}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-3 px-4 pb-4">
                    {lead && (
                      <div className="flex items-center space-x-2 p-2 bg-amber-50 rounded-lg">
                        <Crown className="w-4 h-4 text-amber-600" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-800 truncate">
                            Chef: {lead.firstName} {lead.lastName}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-2">
                        {t("members")} ({teamMembers.length})
                      </p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {teamMembers.length > 0 ? (
                          teamMembers.map((member) => {
                            const hasRotation = hasValidRotation(member);
                            return (
                              <div key={member.id} className="flex items-center justify-between p-1.5 bg-slate-50 rounded">
                                <div className="flex items-center space-x-2 min-w-0 flex-1">
                                  <Avatar className="w-6 h-6">
                                    <AvatarFallback className="text-xs bg-gradient-to-br from-slate-500 to-slate-600 text-white">
                                      {member.firstName[0]}{member.lastName[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <p className="text-xs font-medium text-slate-700 truncate">
                                    {member.firstName} {member.lastName}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1">
                                  {hasRotation && (
                                    <RotateCw className="w-3 h-3 text-purple-600" />
                                  )}
                                  {member.workPercent && member.workPercent < 100 && (
                                    <Badge variant="outline" className="text-xs h-5 px-1">
                                      {member.workPercent}%
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-xs text-slate-500 italic text-center py-2">
                            {t("noMembersInTeam")}
                          </p>
                        )}
                      </div>
                    </div>
                  
                    <div className="flex items-center justify-between pt-2 border-t">
                      <Button
                        onClick={() => {
                          const teamMemberIds = users
                            .filter(u => u.teamId === team.id)
                            .map(u => u.id);

                          setSelectedTeam({
                            id: team.id,
                            name: team.name,
                            description: team.description || '',
                            color: team.color,
                            leadId: team.leadId || 'none',
                            memberIds: teamMemberIds
                          });
                          setIsEditTeamDialogOpen(true);
                        }}
                        variant="outline"
                        size="sm"
                        className="flex-1 mr-2 h-8 text-xs hover:bg-secondary/20"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        {tCommon("edit")}
                      </Button>
                      <Button
                        onClick={() => {
                          setDeleteTeamId(team.id);
                          setIsDeleteTeamDialogOpen(true);
                        }}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 h-8 px-2"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Dialog de modification d'utilisateur */}
        <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("editUser")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("firstName")} *</Label>
                  <Input
                    value={selectedUser?.firstName || ''}
                    onChange={(e) => setSelectedUser({...selectedUser, firstName: e.target.value})}
                  />
                </div>
                <div>
                  <Label>{t("lastName")} *</Label>
                  <Input
                    value={selectedUser?.lastName || ''}
                    onChange={(e) => setSelectedUser({...selectedUser, lastName: e.target.value})}
                  />
                </div>
              </div>
              
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={selectedUser?.email || ''}
                  onChange={(e) => setSelectedUser({...selectedUser, email: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("phone")}</Label>
                  <Input
                    type="tel"
                    placeholder="+41 XX XXX XX XX"
                    value={selectedUser?.phone || ''}
                    onChange={(e) => setSelectedUser({...selectedUser, phone: e.target.value})}
                  />
                </div>
                <div>
                  <Label>{t("location")}</Label>
                  <Select 
                    value={selectedUser?.location || 'none'} 
                    onValueChange={(value) => setSelectedUser({...selectedUser, location: value === 'none' ? '' : value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectCity")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("notSpecified")}</SelectItem>
                      {SWISS_CANTONS.map((canton) => (
                                <SelectItem 
                                  key={canton.value} 
                                  value={canton.value}
                                >
                                  {canton.label}
                                </SelectItem>
                              ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{tCommon("team")}</Label>
                  <Select 
                    value={selectedUser?.teamId || 'none'} 
                    onValueChange={(value) => setSelectedUser({...selectedUser, teamId: value === 'none' ? '' : value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={tCommon("select")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tCommon("none")}</SelectItem>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {selectedUser && (
                <AvailabilityEditor
                  availability={selectedUser.availability || fullTimeAvailability}
                  onChange={(newAvailability: WeekAvailability) => setSelectedUser({...selectedUser, availability: newAvailability})}
                  workType={editWorkType}
                  onWorkTypeChange={(type: string) => {
                    setEditWorkType(type as 'full' | 'partial');
                    
                    // Si on passe en temps plein, réinitialiser la disponibilité
                    if (type === 'full') {
                      setSelectedUser({
                        ...selectedUser,
                        availability: fullTimeAvailability,
                        workPercent: 100
                      });
                    }
                  }}
                  rotationConfig={selectedUser.rotationConfig}
                  onRotationConfigChange={(config: RotationConfig | null) => setSelectedUser({...selectedUser, rotationConfig: config})}
                  userId={selectedUser.id}
                  isEditMode={true}
                />
              )}

              <div>
                <Label>Status</Label>
                <Select 
                  value={selectedUser?.status || 'ACTIVE'} 
                  onValueChange={(value) => setSelectedUser({...selectedUser, status: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">{t("active")}</SelectItem>
                    <SelectItem value="INACTIVE">{t("inactive")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>{t("notes")}</Label>
                <Textarea
                  value={selectedUser?.notes || ''}
                  onChange={(e) => setSelectedUser({...selectedUser, notes: e.target.value})}
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={() => {
                  setIsEditUserDialogOpen(false);
                  setSelectedUser(null);
                }} className="hover:bg-secondary/20">
                  {tCommon("cancel")}
                </Button>
                <Button
                  onClick={handleUpdateUser}
                  disabled={isSubmitting}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {tCommon("saving")}</>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {tCommon("save")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog de modification d'équipe */}
        {selectedTeam && (
          <Dialog open={isEditTeamDialogOpen} onOpenChange={setIsEditTeamDialogOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("editTeam")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>{t("teamName")} *</Label>
                  <Input
                    value={selectedTeam.name}
                    onChange={(e) => setSelectedTeam({...selectedTeam, name: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label>{t("teamColor")}</Label>
                  <div className="flex items-center space-x-2 mt-2">
                    {TEAM_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-8 h-8 rounded-lg border-2 ${
                          selectedTeam.color === color ? 'border-slate-800' : 'border-slate-200'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setSelectedTeam({...selectedTeam, color})}
                      />
                    ))}
                  </div>
                </div>
                
                <div>
                  <Label>{t("teamLead")}</Label>
                  <Select
                    value={selectedTeam.leadId || 'none'}
                    onValueChange={(value) => setSelectedTeam({...selectedTeam, leadId: value === 'none' ? '' : value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tCommon("none")}</SelectItem>
                      {users
                        .filter(u => selectedTeam.memberIds?.includes(u.id))
                        .map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Gestion des membres de l'équipe */}
                <div className="border-t pt-4">
                  <Label className="text-base font-semibold mb-3 block">{t("teamMembers")}</Label>
                  <TeamMembersSelector
                    teamId={selectedTeam.id}
                    currentMembers={selectedTeam.memberIds || []}
                    onMembersChange={(memberIds) => setSelectedTeam({...selectedTeam, memberIds})}
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <Button variant="outline" onClick={() => setIsEditTeamDialogOpen(false)} className="hover:bg-secondary/20">
                    {tCommon("cancel")}
                  </Button>
                  <Button
                    onClick={handleUpdateTeam}
                    disabled={isSubmitting}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {tCommon("saving")}</>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {tCommon("save")}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Dialog création de pattern */}
        <Dialog open={isCreatePatternOpen} onOpenChange={setIsCreatePatternOpen}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {newPattern.id ? t("editRotationPattern") : t("createRotationPattern")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("patternName")}</Label>
                  <Input
                    placeholder={t("patternNamePlaceholder")}
                    value={newPattern.name}
                    onChange={(e) => setNewPattern({ ...newPattern, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t("cycleDuration")}</Label>
                  <Select
                    value={newPattern.cycleLength.toString()}
                    onValueChange={(value) => adjustCycleLength(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6].map(n => (
                        <SelectItem key={n} value={n.toString()}>
                          {t("weekCount", { count: n })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>{t("descriptionOptional")}</Label>
                <Input
                  placeholder={t("patternDescriptionPlaceholder")}
                  value={newPattern.description}
                  onChange={(e) => setNewPattern({ ...newPattern, description: e.target.value })}
                />
              </div>

              {/* Sélection de l'utilisateur pour voir ses shifts */}
              <div>
                <Label>{t("basedOnUserShifts")}</Label>
                <Select
                  onValueChange={(userId) => {
                    const user = users.find(u => u.id === userId);
                    if (user) {
                      // Trouver les shifts assignés à cet utilisateur
                      const userShifts = shifts.filter((shift: any) => {
                        const userInTeam = user.teamId === shift.teamId;
                        const userIncluded = shift.includedUserIds?.includes(userId);
                        const userExcluded = shift.excludedUserIds?.includes(userId);
                        return (userInTeam && !userExcluded) || userIncluded;
                      });
                      
                      // Mettre à jour le pattern avec les shifts de l'utilisateur
                      setNewPattern({
                        ...newPattern,
                        userShifts: userShifts.map((s: any) => s.id)
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectUserToViewShifts")} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter(u => u.status === 'ACTIVE').map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.firstName} {user.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Configuration des semaines avec les vrais shifts et prise en compte disponibilités */}
              {newPattern.userShifts && newPattern.userShifts.length > 0 ? (
                <div>
                  <Label>{t("weekConfiguration")}</Label>
                  <Alert className="mb-3 border-blue-200 bg-blue-50">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800 text-sm">
                      {t("weekConfigurationHint")}
                    </AlertDescription>
                  </Alert>
                  
                  {newPattern.weeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="mt-3 p-3 border rounded-lg">
                      <h4 className="font-medium mb-2">{t("weekNumber", { week: weekIndex + 1 })}</h4>
                      <div className="grid grid-cols-7 gap-2">
                        {days.map((day) => {
                          // Vérifier la disponibilité de l'utilisateur pour ce jour
                          const selectedUserId = newPattern.name.includes('Pattern') ? 
                            users.find(u => newPattern.name.includes(u.firstName) && newPattern.name.includes(u.lastName))?.id : 
                            null;
                          const selectedUser = selectedUserId ? users.find(u => u.id === selectedUserId) : null;
                          const userAvailability = selectedUser?.availability;
                          const isDayAvailable = userAvailability ? 
                            (userAvailability[day as keyof WeekAvailability]?.morning || 
                             userAvailability[day as keyof WeekAvailability]?.afternoon) : 
                            true;

                          return (
                            <div key={day} className="text-center">
                              <p className="text-xs font-medium mb-1">{dayLabels[day]}</p>
                              <Select
                                value={week[day]?.[0] || 'none'}
                                onValueChange={(shiftId) => {
                                  const updatedWeeks = [...newPattern.weeks];
                                  if (shiftId === 'none') {
                                    updatedWeeks[weekIndex][day] = [];
                                  } else {
                                    updatedWeeks[weekIndex][day] = [shiftId];
                                  }
                                  setNewPattern({ ...newPattern, weeks: updatedWeeks });
                                }}
                                disabled={!isDayAvailable}
                              >
                                <SelectTrigger className={`w-full h-auto text-xs ${
                                  !isDayAvailable ? 'opacity-50 bg-slate-100 cursor-not-allowed' : ''
                                }`}>
                                  <SelectValue>
                                    {!isDayAvailable ? (
                                      <span className="text-slate-400">{t("unavailableShort")}</span>
                                    ) : week[day]?.[0] ? (
                                      <span className="truncate">
                                        {shifts.find(s => s.id === week[day][0])?.name || 'Shift'}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">{t("free")}</span>
                                    )}
                                  </SelectValue>
                                </SelectTrigger>
                                {isDayAvailable && (
                                  <SelectContent>
                                    <SelectItem value="none">
                                      <span className="text-slate-400">{t("free")}</span>
                                    </SelectItem>
                                      {(newPattern.userShifts || []).map(shiftId => {
                                        const shift = shifts.find((s: any) => s.id === shiftId);
                                        if (!shift) return null;
                                        return (
                                          <SelectItem key={shiftId} value={shiftId}>
                                            <div className="flex items-center gap-2">
                                              <div 
                                                className="w-2 h-2 rounded-full"
                                                style={{ backgroundColor: shift.color }}
                                              />
                                              <span>{shift.name}</span>
                                              <span className="text-xs text-slate-500">
                                                ({shift.startTime}-{shift.endTime})
                                              </span>
                                            </div>
                                          </SelectItem>
                                        );
                                      })}
                                  </SelectContent>
                                )}
                              </Select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {(!newPattern.userShifts || newPattern.userShifts.length === 0) && (
                <Alert className="border-orange-200 bg-orange-50">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800">
                    {t("selectUserFirst")}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={() => {
                  setIsCreatePatternOpen(false);
                  setNewPattern({
                    id: '',
                    name: '',
                    description: '',
                    cycleLength: 2,
                    weeks: [
                      { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] },
                      { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] }
                    ],
                    userShifts: []
                  });
                }} className="hover:bg-secondary/20">
                  {tCommon("cancel")}
                </Button>
                <Button
                  className="bg-[#00ff7b] text-black hover:bg-secondary/90"
                  onClick={async () => {
                    if (!newPattern.name) {
                      showError(t('patternNameRequired'));
                      return;
                    }

                    if (newPattern.id) {
                      // Mode modification
                      await updatePattern({...newPattern, userShifts: newPattern.userShifts || []} as any);
                    } else {
                      // Mode création
                      const newId = Date.now().toString();
                      const patternToAdd = { ...newPattern, id: newId, userShifts: newPattern.userShifts || [] };
                      await addPattern(patternToAdd as any);
                    }

                    setIsCreatePatternOpen(false);
                    setNewPattern({
                      id: '',
                      name: '',
                      description: '',
                      cycleLength: 2,
                      weeks: [
                        { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] },
                        { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] }
                      ],
                      userShifts: []
                    });
                  }}
                  disabled={!newPattern.name || !newPattern.userShifts || newPattern.userShifts.length === 0}
                >
                  {newPattern.id ? t("updatePattern") : t("createPattern")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog de confirmation de suppression de pattern */}
        <Dialog open={isDeletePatternDialogOpen} onOpenChange={setIsDeletePatternDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                {t("confirmDeletion")}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-slate-700">
                {t("confirmDeletePattern")}
              </p>
              {deletePatternId && (
                <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="font-medium text-red-800">
                    {rotationPatterns.find(p => p.id === deletePatternId)?.name}
                  </p>
                  <p className="text-sm text-red-600 mt-1">
                    {t("actionIrreversible")}
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeletePatternDialogOpen(false);
                  setDeletePatternId(null);
                }}
                className="hover:bg-secondary/20"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                onClick={async () => {
                  if (deletePatternId) {
                    await deletePattern(deletePatternId);
                    setIsDeletePatternDialogOpen(false);
                    setDeletePatternId(null);
                  }
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {tCommon("delete")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog de confirmation de suppression d'utilisateur */}
        <Dialog open={isDeleteUserDialogOpen} onOpenChange={setIsDeleteUserDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                {t("confirmDeletion")}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-slate-700">
                {t("deleteUserConfirm")}
              </p>
              {deleteUserId && (
                <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="font-medium text-red-800">
                    {users.find(u => u.id === deleteUserId)?.firstName} {users.find(u => u.id === deleteUserId)?.lastName}
                  </p>
                  <p className="text-sm text-red-600 mt-1">
                    {t("actionIrreversible")}
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteUserDialogOpen(false);
                  setDeleteUserId(null);
                }}
                className="hover:bg-secondary/20"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                onClick={handleDeleteUser}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {tCommon("delete")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog de confirmation de suppression d'équipe */}
        <Dialog open={isDeleteTeamDialogOpen} onOpenChange={setIsDeleteTeamDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                {t("confirmDeletion")}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-slate-700">
                {t("deleteTeamConfirm")}
              </p>
              {deleteTeamId && (
                <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="font-medium text-red-800">
                    {teams.find(t => t.id === deleteTeamId)?.name}
                  </p>
                  <p className="text-sm text-red-600 mt-1">
                    {t("actionIrreversible")}
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteTeamDialogOpen(false);
                  setDeleteTeamId(null);
                }}
                className="hover:bg-secondary/20"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                onClick={handleDeleteTeam}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {tCommon("delete")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog d'erreur personnalisé */}
        <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                Erreur
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-slate-700">
                {errorMessage}
              </p>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => setErrorDialogOpen(false)}
                className="bg-[#00ff7b] text-black hover:bg-[#00ff7b]/90"
              >
                OK
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
};

export default function UsersPageProtected() {
  return <ProtectedRoute><UsersPage /></ProtectedRoute>;
}