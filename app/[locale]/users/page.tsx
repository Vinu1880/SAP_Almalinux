'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navigation from '@/components/Navigation';
import { useTranslations } from 'next-intl';
import {
  Users, Plus, Edit, Trash2, Search, Mail, Phone,
  UserCheck, Loader2, AlertCircle, Save, X, Sun, Moon,
  Building2, Crown, RotateCw, Info, AlertTriangle,
  UserPlus, UserMinus, Grid3X3, List, Filter,
  ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, Copy, Network,
  Upload, Download
} from 'lucide-react';
import { useShifts } from '@/lib/hooks/useShifts';
import { usePiketts } from '@/lib/hooks/usePiketts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRotationPatterns } from '@/contexts/RotationPatternsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useUsers } from '@/lib/hooks/useUsers';
import { useTeams } from '@/lib/hooks/useTeams';
import { useAuthFetch } from '@/lib/hooks/useAuthFetch';

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

const TEAM_COLORS = [
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

const SWISS_CANTONS = [
  { value: 'VD', labelKey: 'cantonVaud' },
  { value: 'BE', labelKey: 'cantonBerne' },
  { value: 'ZH', labelKey: 'cantonZurich' }
] as const;

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
  const [patternUserId, setPatternUserId] = useState<string | null>(null);
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
  const [teamSortBy, setTeamSortBy] = useState<'name' | 'members'>('name');
  const [teamSortOrder, setTeamSortOrder] = useState<'asc' | 'desc'>('asc');

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
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [workType, setWorkType] = useState<'full' | 'partial' | 'joker'>('full');
  const [editWorkType, setEditWorkType] = useState<'full' | 'partial' | 'joker'>('full');
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { patterns: rotationPatterns, addPattern, updatePattern, deletePattern } = useRotationPatterns();
  const { shifts, loading: shiftsLoading } = useShifts();
  const { piketts } = usePiketts();
  const authFetch = useAuthFetch();

  const [userRules, setUserRules] = useState<any[]>([]);
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [newRule, setNewRule] = useState<any>({
    type: 'WEEK_PARITY',
    config: { parity: 'odd' },
    enabled: true,
  });

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

  // Auto-load user shifts when pattern modal opens
  useEffect(() => {
    if (isCreatePatternOpen && patternUserId && (!newPattern.userShifts || newPattern.userShifts.length === 0)) {
      const user = users.find(u => u.id === patternUserId);
      if (user) {
        const userShifts = shifts.filter((shift: any) => {
          const userInTeam = user.teamId === shift.teamId;
          const userIncluded = shift.includedUserIds?.includes(patternUserId);
          const userExcluded = shift.excludedUserIds?.includes(patternUserId);
          return (userInTeam && !userExcluded) || userIncluded;
        });
        if (userShifts.length > 0) {
          setNewPattern(prev => ({
            ...prev,
            userShifts: userShifts.map((s: any) => s.id)
          }));
        }
      }
    }
  }, [isCreatePatternOpen, patternUserId, shifts, users]);

  const hasValidRotation = (user: any): boolean => {
    return !!(user.rotationConfig &&
             typeof user.rotationConfig === 'object' &&
             user.rotationConfig.patternId &&
             user.rotationConfig.patternId !== '');
  };

  const getRotationConfig = (user: any): RotationConfig | null => {
    if (!hasValidRotation(user)) return null;
    
    return {
      patternId: user.rotationConfig.patternId,
      allowedShiftTypes: user.rotationConfig.allowedShiftTypes || []
    };
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setErrorDialogOpen(true);
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const calculateWorkPercent = (availability: WeekAvailability | null | undefined): number => {
    if (!availability) return 100;
    
    let totalSlots = 0;
    let availableSlots = 0;
    const workDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    
    workDays.forEach((day) => {
      totalSlots += 2;
      const dayAvail = availability[day as keyof WeekAvailability];
      if (dayAvail?.morning) availableSlots++;
      if (dayAvail?.afternoon) availableSlots++;
    });

    if (availableSlots === 10) return 100;

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
    // 0% = "joker" user: manual-only assignment, never auto-picked
    if (percent === 0) {
      return (
        <Badge className="bg-purple-100 text-purple-800 border-0">
          {t('joker')}
        </Badge>
      );
    }
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

    const isDayAvailable = (day: string) => {
      const dayAvail = availability[day as keyof WeekAvailability];
      return dayAvail?.morning || dayAvail?.afternoon;
    };

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
        {/* Support rate section */}
        <div className="space-y-4">
          <div>
            <Label className="text-base font-semibold">{t("contractType")}</Label>
            <p className="text-sm text-slate-600 mb-3">{t("defineDaysAndSlots")}</p>
          </div>
          
          <RadioGroup value={localWorkType} onValueChange={(value) => {
            onWorkTypeChange(value);

            if (value === 'full') {
              onChange(fullTimeAvailability);
            } else if (value === 'joker') {
              // Joker = no availability at all → cannot be auto-assigned, only manual
              const empty: any = {
                monday: { morning: false, afternoon: false },
                tuesday: { morning: false, afternoon: false },
                wednesday: { morning: false, afternoon: false },
                thursday: { morning: false, afternoon: false },
                friday: { morning: false, afternoon: false },
                saturday: { morning: false, afternoon: false },
                sunday: { morning: false, afternoon: false },
              };
              onChange(empty);
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
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="joker" id={`joker-${userId || 'new'}`} />
              <Label htmlFor={`joker-${userId || 'new'}`} className="font-normal cursor-pointer">
                {t("joker")}
                <span className="ml-2 text-xs text-slate-500">— {t("jokerDesc")}</span>
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

        {/* Automatic rotation section - INDEPENDENT */}
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
                {/* Rotation configuration */}
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

                    {/* List of existing patterns with delete option */}
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
                                  className="hover:bg-red-100 hover:text-red-600"
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
                        if (userId && isEditMode) {
                          const userShifts = getUserShifts();
                          setNewPattern({
                            ...newPattern,
                            userShifts: userShifts.map((s: any) => s.id),
                            name: `Pattern ${selectedUser?.firstName || ''} ${selectedUser?.lastName || ''}`.trim()
                          });
                          setPatternUserId(userId);
                        } else {
                          setPatternUserId(null);
                        }
                        setIsCreatePatternOpen(true);
                      }}
                      className="w-full mt-2 hover:bg-secondary/20"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      {t("createNewPattern")}
                    </Button>
                  </div>

                  {/* Display and edit the current pattern if selected */}
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
                                    const dayAvail = availability[day as keyof WeekAvailability];
                                    const hasMorning = dayAvail?.morning === true;
                                    const hasAfternoon = dayAvail?.afternoon === true;

                                    const filteredShifts = userShifts.filter((shift: any) => {
                                      if (!dayAvail) return true;
                                      const startHour = parseInt(shift.startTime?.split(':')[0] || '0');
                                      const endHour = parseInt(shift.endTime?.split(':')[0] || '0');
                                      const needsMorning = startHour < 13;
                                      const needsAfternoon = endHour > 13 || (endHour < startHour);
                                      if (needsMorning && !hasMorning) return false;
                                      if (needsAfternoon && !hasAfternoon) return false;
                                      return true;
                                    });

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
                                          disabled={!dayAvailable || filteredShifts.length === 0}
                                        >
                                          <SelectTrigger className={`w-full h-auto text-xs py-1 ${
                                            (!dayAvailable || filteredShifts.length === 0) ? 'opacity-50 bg-slate-100' : ''
                                          }`}>
                                            <SelectValue>
                                              {!dayAvailable ? (
                                                <span className="text-slate-400">{t("unavailableShort")}</span>
                                              ) : filteredShifts.length === 0 ? (
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
                                          {dayAvailable && filteredShifts.length > 0 && (
                                            <SelectContent>
                                              <SelectItem value="none">
                                                <span className="text-slate-400">{t("free")}</span>
                                              </SelectItem>
                                              {filteredShifts.map((shift: any) => (
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

  const TeamMembersSelector = ({
    teamId,
    currentMembers,
    onMembersChange
  }: {
    teamId: string,
    currentMembers: string[],
    onMembersChange: (memberIds: string[]) => void
  }) => {
    const [memberSearch, setMemberSearch] = useState('');
    const [availableSearch, setAvailableSearch] = useState('');

    const matches = (u: any, q: string) => {
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      return `${u.firstName} ${u.lastName} ${u.email || ''} ${u.role || ''}`
        .toLowerCase()
        .includes(needle);
    };

    const allTeamUsers = users.filter(u => currentMembers.includes(u.id));
    const allAvailable = users.filter(u =>
      !currentMembers.includes(u.id) &&
      u.status === 'ACTIVE'
    );

    const teamUsers = allTeamUsers.filter(u => matches(u, memberSearch));
    const availableUsers = allAvailable.filter(u => matches(u, availableSearch));

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
              {allTeamUsers.length}
            </Badge>
          </div>
          {allTeamUsers.length > 0 && (
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <Input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder={t("searchMember")}
                className="h-8 pl-8 text-sm"
              />
            </div>
          )}
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
                    className="hover:bg-red-100 hover:text-red-600"
                    onClick={() => handleRemoveFromTeam(user.id)}
                  >
                    <UserMinus className="w-3 h-3" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">
                {memberSearch.trim() ? t("noSearchResult") : t("noMembersInTeam")}
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">{t("availableUsers")}</Label>
            <Badge variant="outline" className="text-xs">
              {allAvailable.length}
            </Badge>
          </div>
          {allAvailable.length > 0 && (
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <Input
                value={availableSearch}
                onChange={(e) => setAvailableSearch(e.target.value)}
                placeholder={t("searchUser")}
                className="h-8 pl-8 text-sm"
              />
            </div>
          )}
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
                {availableSearch.trim() ? t("noSearchResult") : t("allUsersAssigned")}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // CSV import/export for users & teams
  const [isImportingUsersCsv, setIsImportingUsersCsv] = useState(false);
  const [isImportingTeamsCsv, setIsImportingTeamsCsv] = useState(false);
  const usersCsvInputRef = React.useRef<HTMLInputElement>(null);
  const teamsCsvInputRef = React.useRef<HTMLInputElement>(null);

  const csvEscape = (v: any): string => {
    const s = v === null || v === undefined ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const parseCsvLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else cur += c;
      } else {
        if (c === ',') { out.push(cur); cur = ''; }
        else if (c === '"') inQuotes = true;
        else cur += c;
      }
    }
    out.push(cur);
    return out.map(s => s.trim());
  };

  const downloadCsv = (rows: string[][], filename: string) => {
    const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const handleExportUsersCsv = () => {
    const header = ['firstName', 'lastName', 'email', 'phone', 'location', 'role', 'workPercent', 'team', 'notes', 'status'];
    const rows: string[][] = [header];
    for (const u of users) {
      const team = teams.find((t: any) => t.id === u.teamId)?.name || '';
      rows.push([
        u.firstName || '', u.lastName || '', u.email || '', u.phone || '',
        u.location || '', u.role || '', String(u.workPercent ?? 100),
        team, u.notes || '', u.status || 'ACTIVE',
      ]);
    }
    const today = new Date().toISOString().split('T')[0];
    downloadCsv(rows, `users_${today}.csv`);
  };

  const handleExportTeamsCsv = () => {
    const header = ['name', 'description', 'color'];
    const rows: string[][] = [header];
    for (const team of teams) {
      rows.push([team.name || '', team.description || '', team.color || '#3b82f6']);
    }
    const today = new Date().toISOString().split('T')[0];
    downloadCsv(rows, `teams_${today}.csv`);
  };

  const handleImportUsersCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImportingUsersCsv(true);
    try {
      const text = await file.text();
      const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/);
      if (lines.length < 2) throw new Error(t('csvEmptyError'));
      const header = parseCsvLine(lines[0]).map(h => h.toLowerCase());
      const idx = (name: string) => header.indexOf(name.toLowerCase());
      const iFirst = idx('firstName');
      const iLast = idx('lastName');
      const iEmail = idx('email');
      if (iFirst === -1 || iLast === -1 || iEmail === -1) {
        throw new Error(t('csvUsersHeaderError'));
      }
      const iPhone = idx('phone');
      const iLoc = idx('location');
      const iRole = idx('role');
      const iWp = idx('workPercent');
      const iTeam = idx('team');
      const iNotes = idx('notes');
      let created = 0;
      let skipped = 0;
      const errors: string[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 3) continue;
        const email = cols[iEmail];
        if (!email) { skipped++; continue; }
        if (users.some((u: any) => u.email?.toLowerCase() === email.toLowerCase())) { skipped++; continue; }
        const teamName = iTeam >= 0 ? cols[iTeam] : '';
        const team = teamName ? teams.find((tt: any) => tt.name?.toLowerCase() === teamName.toLowerCase()) : null;
        try {
          await createUser({
            firstName: cols[iFirst] || '',
            lastName: cols[iLast] || '',
            email,
            phone: iPhone >= 0 ? cols[iPhone] || undefined : undefined,
            location: iLoc >= 0 ? cols[iLoc] || undefined : undefined,
            role: iRole >= 0 ? cols[iRole] || undefined : undefined,
            workPercent: iWp >= 0 && cols[iWp] !== '' ? parseInt(cols[iWp], 10) : 100,
            teamId: team?.id || undefined,
            notes: iNotes >= 0 ? cols[iNotes] || undefined : undefined,
            status: 'ACTIVE',
          });
          created++;
        } catch (err: any) {
          errors.push(`${email}: ${err.message || 'failed'}`);
        }
      }
      if (usersCsvInputRef.current) usersCsvInputRef.current.value = '';
      alert(errors.length
        ? t('csvImportResultWithErrors', { created, skipped, errorCount: errors.length, errorDetails: errors.slice(0, 3).join('; ') })
        : t('csvImportResult', { created, skipped }));
    } catch (e: any) {
      alert(e.message || t('csvImportFailed'));
    } finally {
      setIsImportingUsersCsv(false);
    }
  };

  const handleImportTeamsCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImportingTeamsCsv(true);
    try {
      const text = await file.text();
      const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/);
      if (lines.length < 2) throw new Error(t('csvEmptyError'));
      const header = parseCsvLine(lines[0]).map(h => h.toLowerCase());
      const iName = header.indexOf('name');
      if (iName === -1) throw new Error(t('csvTeamsHeaderError'));
      const iDesc = header.indexOf('description');
      const iColor = header.indexOf('color');
      let created = 0;
      let skipped = 0;
      const errors: string[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const name = cols[iName];
        if (!name) { skipped++; continue; }
        if (teams.some((tt: any) => tt.name?.toLowerCase() === name.toLowerCase())) { skipped++; continue; }
        try {
          await createTeam({
            name,
            description: iDesc >= 0 ? cols[iDesc] || undefined : undefined,
            color: iColor >= 0 && cols[iColor] ? cols[iColor] : '#3b82f6',
          });
          created++;
        } catch (err: any) {
          errors.push(`${name}: ${err.message || 'failed'}`);
        }
      }
      if (teamsCsvInputRef.current) teamsCsvInputRef.current.value = '';
      alert(errors.length
        ? t('csvImportResultWithErrors', { created, skipped, errorCount: errors.length, errorDetails: errors.slice(0, 3).join('; ') })
        : t('csvImportResult', { created, skipped }));
    } catch (e: any) {
      alert(e.message || t('csvImportFailed'));
    } finally {
      setIsImportingTeamsCsv(false);
    }
  };

  const handleCreateUser = async () => {
    const errors: Record<string, boolean> = {};
    if (!newUser.firstName) errors.userFirstName = true;
    if (!newUser.lastName) errors.userLastName = true;
    if (!newUser.email) errors.userEmail = true;
    else if (!isValidEmail(newUser.email)) errors.userEmail = true;
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});

    setIsSubmitting(true);
    try {
      const userData: any = {
        ...newUser,
        location: newUser.location || undefined,
        teamId: newUser.teamId || undefined,
        workPercent: calculateWorkPercent(newUser.availability),
        status: 'ACTIVE'
      };

      if (newUser.rotationConfig?.patternId) {
        userData.rotationConfig = newUser.rotationConfig;
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
      if (error.response?.data?.error) {
        showError(error.response.data.error);
      } else if (error.message) {
        showError(error.message);
      } else {
        showError(t('createUserError'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicateUser = (user: any) => {
    setNewUser({
      firstName: user.firstName,
      lastName: `${user.lastName} (Copy)`,
      email: '',
      phone: user.phone || '',
      location: user.location || '',
      teamId: user.teamId || '',
      role: user.role || '',
      workPercent: user.workPercent ?? 100,
      notes: user.notes || '',
      availability: user.availability || fullTimeAvailability,
      rotationConfig: user.rotationConfig ? getRotationConfig(user) : null,
    });
    setWorkType(
      user.workPercent === 0 ? 'joker' :
      (user.workPercent && user.workPercent < 100 ? 'partial' : 'full')
    );
    setIsCreateUserDialogOpen(true);
  };

  const handleDuplicateTeam = (team: any) => {
    setNewTeam({
      name: `${team.name} (Copy)`,
      description: team.description || '',
      color: team.color || '#3b82f6',
      leadId: '',
    });
    setIsCreateTeamDialogOpen(true);
  };

  const fetchUserRules = async (userId: string) => {
    try {
      const res = await authFetch(`/api/users/${userId}/rules`);
      if (res.ok) setUserRules(await res.json());
    } catch { /* ignore */ }
  };

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    if (!selectedUser) return;
    try {
      await authFetch(`/api/users/${selectedUser.id}/rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      await fetchUserRules(selectedUser.id);
    } catch (e: any) {
      showError(e.message);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!selectedUser) return;
    try {
      await authFetch(`/api/users/${selectedUser.id}/rules/${ruleId}`, { method: 'DELETE' });
      await fetchUserRules(selectedUser.id);
    } catch (e: any) {
      showError(e.message);
    }
  };

  const handleStartEditRule = (rule: any) => {
    setEditingRuleId(rule.id);
    setNewRule({ type: rule.type, config: { ...rule.config }, enabled: rule.enabled });
    setIsAddingRule(true);
  };

  const handleSaveRule = async () => {
    if (!selectedUser) return;
    try {
      const existingRules = userRules.filter((r: any) => editingRuleId ? r.id !== editingRuleId : true);
      if (newRule.type === 'WEEK_PARITY') {
        const existing = existingRules.find((r: any) => r.type === 'WEEK_PARITY');
        if (existing) {
          showError(t('ruleDuplicateWeekParity'));
          return;
        }
      }
      if (newRule.type === 'MAX_LOAD') {
        const existing = existingRules.find((r: any) => r.type === 'MAX_LOAD' && r.config.shiftId === newRule.config.shiftId);
        if (existing) {
          showError(t('ruleDuplicateMaxLoad'));
          return;
        }
      }
      if (newRule.type === 'DOUBLE_SHIFT') {
        const existing = existingRules.find((r: any) => r.type === 'DOUBLE_SHIFT' && r.config.triggerShiftId === newRule.config.triggerShiftId);
        if (existing) {
          showError(t('ruleDuplicateDoubleShift'));
          return;
        }
      }
      if (editingRuleId) {
        const res = await authFetch(`/api/users/${selectedUser.id}/rules/${editingRuleId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newRule),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed');
        }
      } else {
        const res = await authFetch(`/api/users/${selectedUser.id}/rules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newRule),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed');
        }
      }
      await fetchUserRules(selectedUser.id);
      setIsAddingRule(false);
      setEditingRuleId(null);
      setNewRule({ type: 'WEEK_PARITY', config: { parity: 'odd' }, enabled: true });
    } catch (e: any) {
      showError(e.message);
    }
  };

  const handleRuleTypeChange = (type: string) => {
    const defaults: Record<string, any> = {
      WEEK_PARITY: { parity: 'odd' },
      DOUBLE_SHIFT: { triggerShiftId: '', linkedShiftId: '' },
      MAX_LOAD: { shiftId: '', maxPercentage: 50 },
    };
    setNewRule({ type, config: defaults[type], enabled: true });
  };

  const getRuleTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      WEEK_PARITY: t('ruleWeekParity'),
      DOUBLE_SHIFT: t('ruleDoubleShift'),
      MAX_LOAD: t('ruleMaxLoad'),
    };
    return labels[type] || type;
  };

  const getRuleDescription = (rule: any) => {
    const findShiftOrPikett = (id: string) => shifts.find((s: any) => s.id === id) || piketts.find((p: any) => p.id === id);
    switch (rule.type) {
      case 'WEEK_PARITY':
        return rule.config.parity === 'odd' ? t('oddWeeksOnly') : t('evenWeeksOnly');
      case 'DOUBLE_SHIFT': {
        const trigger = findShiftOrPikett(rule.config.triggerShiftId);
        const linked = findShiftOrPikett(rule.config.linkedShiftId);
        return t('doubleShiftDesc', { trigger: trigger?.name || '?', linked: linked?.name || '?' });
      }
      case 'MAX_LOAD': {
        const shift = findShiftOrPikett(rule.config.shiftId);
        return t('maxLoadDesc', { shift: shift?.name || '?', pct: rule.config.maxPercentage });
      }
      default: return '';
    }
  };

  const getUserShiftsForRules = (user: any) => {
    if (!user) return [];
    const userShifts = shifts.filter((shift: any) => {
      const inTeam = user.teamId === shift.teamId;
      const included = shift.includedUserIds?.includes(user.id);
      const excluded = shift.excludedUserIds?.includes(user.id);
      return (inTeam && !excluded) || included;
    });
    const userPiketts = piketts.filter((pikett: any) => {
      const inTeam = user.teamId === pikett.teamId;
      const included = pikett.includedUserIds?.includes(user.id);
      const excluded = pikett.excludedUserIds?.includes(user.id);
      return (inTeam && !excluded) || included;
    });
    return [...userShifts, ...userPiketts];
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    const errors: Record<string, boolean> = {};
    if (!selectedUser.firstName) errors.editUserFirstName = true;
    if (!selectedUser.lastName) errors.editUserLastName = true;
    if (!selectedUser.email) errors.editUserEmail = true;
    else if (!isValidEmail(selectedUser.email)) errors.editUserEmail = true;
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});

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

      if (selectedUser.rotationConfig?.patternId) {
        userData.rotationConfig = selectedUser.rotationConfig;
      } else {
        userData.rotationConfig = null;
      }

      await updateUser(selectedUser.id, userData);

      setIsEditUserDialogOpen(false);
      setSelectedUser(null);
      setEditWorkType('full');
    } catch (error: any) {
      if (error.response?.data?.error) {
        showError(error.response.data.error);
      } else if (error.message) {
        showError(error.message);
      } else {
        showError(t('updateUserError'));
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
      showError(error instanceof Error ? error.message : t('deleteUserError'));
    }
  };

  const handleCreateTeam = async () => {
    const errors: Record<string, boolean> = {};
    if (!newTeam.name) errors.teamName = true;
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});

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
      showError(t('createTeamError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTeam = async () => {
    if (!selectedTeam) return;

    const errors: Record<string, boolean> = {};
    if (!selectedTeam.name) errors.editTeamName = true;
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});

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

      await refetchUsers();
      await refetchTeams();

      setIsEditTeamDialogOpen(false);
      setSelectedTeam(null);
    } catch (error) {
      showError(t('updateTeamError'));
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
      showError(error instanceof Error ? error.message : t('deleteTeamError'));
    }
  };

  const openEditUser = (user: any) => {
    setEditWorkType(
      user.workPercent === 0 ? 'joker' :
      (user.workPercent && user.workPercent < 100 ? 'partial' : 'full')
    );
    setSelectedUser({
      id: user.id, firstName: user.firstName || '', lastName: user.lastName || '',
      email: user.email || '', phone: user.phone || '', location: user.location || '',
      teamId: user.teamId || '', role: user.role || '', workPercent: user.workPercent ?? 100,
      status: user.status || 'ACTIVE', notes: user.notes || '',
      availability: user.availability || fullTimeAvailability, rotationConfig: getRotationConfig(user)
    });
    setIsEditUserDialogOpen(true);
    fetchUserRules(user.id);
  };

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

  const filteredTeams = teams
    .filter(team => {
      const matchesSearch = team.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (teamSortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (teamSortBy === 'members') {
        const aMembers = users.filter(u => u.teamId === a.id).length;
        const bMembers = users.filter(u => u.teamId === b.id).length;
        comparison = aMembers - bMembers;
      }
      return teamSortOrder === 'asc' ? comparison : -comparison;
    });

  const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayLabels = {
    monday: 'Mon',
    tuesday: 'Tue',
    wednesday: 'Wed',
    thursday: 'Thu',
    friday: 'Fri',
    saturday: 'Sat',
    sunday: 'Sun'
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
              <Network className="w-5 h-5 mr-2" />
              {t("teams")}
              <Badge variant="secondary" className="ml-2">
                {teams.length}
              </Badge>
            </Button>
          </div>

          {viewMode === 'users' ? (
            <div className="flex items-center gap-2">
              <input
                ref={usersCsvInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImportUsersCsv}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportUsersCsv}
                title={t('exportCsv')}
                className="hover:bg-green-50 hover:text-green-700 hover:border-green-200"
              >
                <Download className="w-4 h-4 mr-1" />
                {t('exportCsv')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => usersCsvInputRef.current?.click()}
                disabled={isImportingUsersCsv}
                title={t('importCsv')}
                className="hover:bg-green-50 hover:text-green-700 hover:border-green-200"
              >
                {isImportingUsersCsv
                  ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  : <Upload className="w-4 h-4 mr-1" />}
                {t('importCsv')}
              </Button>
              <Button className="bg-primary hover:bg-primary/90" onClick={() => setIsCreateUserDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {t("createUser")}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                ref={teamsCsvInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImportTeamsCsv}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportTeamsCsv}
                title={t('exportCsv')}
                className="hover:bg-green-50 hover:text-green-700 hover:border-green-200"
              >
                <Download className="w-4 h-4 mr-1" />
                {t('exportCsv')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => teamsCsvInputRef.current?.click()}
                disabled={isImportingTeamsCsv}
                title={t('importCsv')}
                className="hover:bg-green-50 hover:text-green-700 hover:border-green-200"
              >
                {isImportingTeamsCsv
                  ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  : <Upload className="w-4 h-4 mr-1" />}
                {t('importCsv')}
              </Button>
              <Button className="bg-primary hover:bg-primary/90" onClick={() => setIsCreateTeamDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {t("createTeam")}
              </Button>
            </div>
          )}
        </div>

        {/* Filter bar and actions */}
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
                        <Network className="w-4 h-4 mr-2 text-slate-500" />
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

                {viewMode === 'teams' && (
                  <Select
                    value={`${teamSortBy}-${teamSortOrder}`}
                    onValueChange={(value) => {
                      const [field, order] = value.split('-');
                      setTeamSortBy(field as 'name' | 'members');
                      setTeamSortOrder(order as 'asc' | 'desc');
                    }}
                  >
                    <SelectTrigger className="w-auto">
                      <ArrowUpDown className="w-4 h-4 mr-2" />
                      <span className="text-sm">
                        {teamSortOrder === 'asc' ? '↑' : '↓'} {teamSortBy === 'name' ? tCommon("name") : t("members")}
                      </span>
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
                      <SelectItem value="members-asc">
                        <div className="flex items-center gap-2">
                          <ArrowUp className="w-4 h-4 text-blue-600" />
                          <span>{t("members")}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="members-desc">
                        <div className="flex items-center gap-2">
                          <ArrowDown className="w-4 h-4 text-orange-600" />
                          <span>{t("members")}</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
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

                {viewMode === 'teams' && (
                  <span className="text-sm text-slate-600">
                    {filteredTeams.length} {filteredTeams.length > 1 ? t("teams") : tCommon("team")}
                  </span>
                )}
                
                {viewMode === 'users' ? (
                  <Dialog open={isCreateUserDialogOpen} onOpenChange={(open) => { setIsCreateUserDialogOpen(open); if (!open) setValidationErrors({}); }}>
                    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{t("createUser")}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>{t("firstName")}</Label>
                            <Input
                              value={newUser.firstName}
                              onChange={(e) => { setNewUser({...newUser, firstName: e.target.value}); setValidationErrors(prev => ({...prev, userFirstName: false})); }}
                              className={validationErrors.userFirstName ? 'border-red-400 ring-2 ring-red-100 shadow-[0_0_8px_rgba(239,68,68,0.15)]' : ''}
                            />
                          </div>
                          <div>
                            <Label>{t("lastName")}</Label>
                            <Input
                              value={newUser.lastName}
                              onChange={(e) => { setNewUser({...newUser, lastName: e.target.value}); setValidationErrors(prev => ({...prev, userLastName: false})); }}
                              className={validationErrors.userLastName ? 'border-red-400 ring-2 ring-red-100 shadow-[0_0_8px_rgba(239,68,68,0.15)]' : ''}
                            />
                          </div>
                        </div>

                        <div>
                          <Label>Email</Label>
                          <Input
                            type="email"
                            value={newUser.email}
                            onChange={(e) => { setNewUser({...newUser, email: e.target.value}); setValidationErrors(prev => ({...prev, userEmail: false})); }}
                            className={validationErrors.userEmail ? 'border-red-400 ring-2 ring-red-100 shadow-[0_0_8px_rgba(239,68,68,0.15)]' : ''}
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
                                  {t(canton.labelKey)}
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
                            setWorkType(type as 'full' | 'partial' | 'joker');
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
                  <Dialog open={isCreateTeamDialogOpen} onOpenChange={(open) => { setIsCreateTeamDialogOpen(open); if (!open) setValidationErrors({}); }}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("createTeam")}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label>{t("teamName")}</Label>
                          <Input
                            placeholder="ex: IT Support"
                            value={newTeam.name}
                            onChange={(e) => { setNewTeam({...newTeam, name: e.target.value}); setValidationErrors(prev => ({...prev, teamName: false})); }}
                            className={validationErrors.teamName ? 'border-red-400 ring-2 ring-red-100 shadow-[0_0_8px_rgba(239,68,68,0.15)]' : ''}
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

        {/* Users view */}
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
                      {/* HIGHLY VISIBLE ROTATION INDICATOR */}
                      {hasRotation && (
                        <div className="absolute -top-2 -right-2 z-10">
                          <div className="bg-gradient-to-br from-orange-400 to-orange-600 rounded-full p-2 shadow-lg">
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
                        
                        <div className="mt-3 rounded-lg bg-slate-50 p-2.5 flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-2 text-xs min-w-0 flex-1">
                            <div className="w-5 h-5 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <Mail className="w-3 h-3 text-blue-600" />
                            </div>
                            <span className="text-slate-600 truncate">{user.email}</span>
                          </div>
                          {user.location && (
                            <div className="flex items-center gap-2 text-xs flex-shrink-0">
                              <div className="w-5 h-5 rounded-md bg-purple-100 flex items-center justify-center flex-shrink-0">
                                <Building2 className="w-3 h-3 text-purple-600" />
                              </div>
                              <span className="text-slate-600">{user.location}</span>
                            </div>
                          )}
                          {user.phone && (
                            <div className="flex items-center gap-2 text-xs flex-shrink-0">
                              <div className="w-5 h-5 rounded-md bg-green-100 flex items-center justify-center flex-shrink-0">
                                <Phone className="w-3 h-3 text-green-600" />
                              </div>
                              <span className="text-slate-600">{user.phone}</span>
                            </div>
                          )}
                        </div>

                        {hasRotation && rotationPattern && (
                          <div className="mt-3 p-2 bg-orange-50 rounded-lg border border-orange-200">
                            <p className="text-xs font-semibold text-orange-700 flex items-center">
                              <RotateCw className="w-3 h-3 mr-1" />
                              {rotationPattern.name}
                            </p>
                          </div>
                        )}

                        {/* User rules badges */}
                        {user.rules && user.rules.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {user.rules.filter((r: any) => r.enabled).map((rule: any) => (
                              <Badge key={rule.id} variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-700">
                                {getRuleTypeLabel(rule.type)}
                              </Badge>
                            ))}
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
                            {getWorkPercentBadge(user.workPercent ?? 100)}
                          </div>
                          {getStatusBadge(user.status)}
                        </div>

                        <div className="flex items-center gap-2 pt-3 mt-3 border-t">
                          <Button onClick={() => openEditUser(user)} variant="outline" size="sm" className="flex-1 hover:bg-secondary/20">
                            <Edit className="w-4 h-4 mr-1" />
                            {tCommon("edit")}
                          </Button>
                          <Button
                            onClick={() => handleDuplicateUser(user)}
                            variant="outline"
                            size="sm"
                            className="hover:bg-secondary/20"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => {
                              setDeleteUserId(user.id);
                              setIsDeleteUserDialogOpen(true);
                            }}
                            variant="outline"
                            size="sm"
                            className="hover:bg-red-100 hover:text-red-600"
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
                      <TableHead>{t("rules")}</TableHead>
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
                                <RotateCw className="w-4 h-4 text-orange-500 animate-spin-slow" />
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
                            {getWorkPercentBadge(user.workPercent ?? 100)}
                          </TableCell>
                          <TableCell>
                            {hasRotation ? (
                              <div className="flex items-center gap-1">
                                <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">
                                  <RotateCw className="w-3 h-3 mr-1" />
                                  {rotationPattern?.name || 'Rotation'}
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.rules && user.rules.filter((r: any) => r.enabled).length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {user.rules.filter((r: any) => r.enabled).map((rule: any) => (
                                  <Badge key={rule.id} variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-700">
                                    {getRuleTypeLabel(rule.type)}
                                  </Badge>
                                ))}
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
                                <DropdownMenuItem onClick={() => openEditUser(user)}>
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

        {/* Teams view */}
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
                          <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            {team.name}
                            <Badge variant="outline" className="text-xs font-normal">
                              <Users className="w-3 h-3 mr-1" />
                              {teamMembers.length}
                            </Badge>
                          </CardTitle>
                          <div className="flex items-center gap-1.5 mt-1">
                            {activeMembers.length !== teamMembers.length && (
                              <Badge variant="outline" className="text-xs bg-green-50">
                                <UserCheck className="w-3 h-3 mr-1" />
                                {activeMembers.length} {activeMembers.length > 1 ? t("activeMembers") : t("activeMember")}
                              </Badge>
                            )}
                            {rotationMembers.length > 0 && (
                              <Badge className="bg-orange-100 text-orange-700 text-xs border-0">
                                <RotateCw className="w-3 h-3 mr-1" />
                                {rotationMembers.length}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-3 px-4 pb-4">
                    {lead && (
                      <div className="flex items-center space-x-2 p-2 bg-amber-50 rounded-lg">
                        <Crown className="w-4 h-4 text-amber-600" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-800 truncate">
                            Lead: {lead.firstName} {lead.lastName}
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
                                    <RotateCw className="w-3 h-3 text-orange-500" />
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
                  
                    <div className="flex items-center gap-2 pt-2 border-t">
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
                        className="flex-1 h-8 text-xs hover:bg-secondary/20"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        {tCommon("edit")}
                      </Button>
                      <Button
                        onClick={() => handleDuplicateTeam(team)}
                        variant="outline"
                        size="sm"
                        className="hover:bg-secondary/20 h-8 px-2"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button
                        onClick={() => {
                          setDeleteTeamId(team.id);
                          setIsDeleteTeamDialogOpen(true);
                        }}
                        variant="outline"
                        size="sm"
                        className="hover:bg-red-100 hover:text-red-600 h-8 px-2"
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

        {/* Edit user dialog */}
        <Dialog open={isEditUserDialogOpen} onOpenChange={(open) => { setIsEditUserDialogOpen(open); if (!open) setValidationErrors({}); }}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("editUser")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("firstName")}</Label>
                  <Input
                    value={selectedUser?.firstName || ''}
                    onChange={(e) => { setSelectedUser({...selectedUser, firstName: e.target.value}); setValidationErrors(prev => ({...prev, editUserFirstName: false})); }}
                    className={validationErrors.editUserFirstName ? 'border-red-400 ring-2 ring-red-100 shadow-[0_0_8px_rgba(239,68,68,0.15)]' : ''}
                  />
                </div>
                <div>
                  <Label>{t("lastName")}</Label>
                  <Input
                    value={selectedUser?.lastName || ''}
                    onChange={(e) => { setSelectedUser({...selectedUser, lastName: e.target.value}); setValidationErrors(prev => ({...prev, editUserLastName: false})); }}
                    className={validationErrors.editUserLastName ? 'border-red-400 ring-2 ring-red-100 shadow-[0_0_8px_rgba(239,68,68,0.15)]' : ''}
                  />
                </div>
              </div>

              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={selectedUser?.email || ''}
                  onChange={(e) => { setSelectedUser({...selectedUser, email: e.target.value}); setValidationErrors(prev => ({...prev, editUserEmail: false})); }}
                  className={validationErrors.editUserEmail ? 'border-red-400 ring-2 ring-red-100 shadow-[0_0_8px_rgba(239,68,68,0.15)]' : ''}
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
                                  {t(canton.labelKey)}
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
                    setEditWorkType(type as 'full' | 'partial' | 'joker');
                    
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

              {/* === User Rules Section === */}
              {selectedUser && (
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">{t('rules')}</Label>
                    <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => setIsAddingRule(true)}>
                      <Plus className="w-4 h-4 mr-1" />
                      {t('addRule')}
                    </Button>
                  </div>

                  {userRules.length === 0 && !isAddingRule && (
                    <p className="text-sm text-slate-500">{t('noRules')}</p>
                  )}

                  {userRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                        />
                        <div>
                          <p className="text-sm font-medium">{getRuleTypeLabel(rule.type)}</p>
                          <p className="text-xs text-slate-500">{getRuleDescription(rule)}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="hover:bg-secondary/20" onClick={() => handleStartEditRule(rule)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="hover:bg-red-100 hover:text-red-600" onClick={() => handleDeleteRule(rule.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {isAddingRule && (
                    <div className="p-4 border rounded-lg bg-blue-50 space-y-3">
                      <Select value={newRule.type} onValueChange={handleRuleTypeChange} disabled={!!editingRuleId}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="WEEK_PARITY">{t('ruleWeekParity')}</SelectItem>
                          <SelectItem value="DOUBLE_SHIFT">{t('ruleDoubleShift')}</SelectItem>
                          <SelectItem value="MAX_LOAD">{t('ruleMaxLoad')}</SelectItem>
                        </SelectContent>
                      </Select>

                      {newRule.type === 'WEEK_PARITY' && (
                        <RadioGroup value={newRule.config.parity} onValueChange={(v) => setNewRule({ ...newRule, config: { parity: v } })}>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="odd" id="parity-odd" />
                            <Label htmlFor="parity-odd">{t('oddWeeks')}</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="even" id="parity-even" />
                            <Label htmlFor="parity-even">{t('evenWeeks')}</Label>
                          </div>
                        </RadioGroup>
                      )}

                      {newRule.type === 'DOUBLE_SHIFT' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">{t('triggerShift')}</Label>
                            <Select value={newRule.config.triggerShiftId || ''} onValueChange={(v) => setNewRule({ ...newRule, config: { ...newRule.config, triggerShiftId: v } })}>
                              <SelectTrigger><SelectValue placeholder={t('selectShift')} /></SelectTrigger>
                              <SelectContent>
                                {getUserShiftsForRules(selectedUser).map((s: any) => (
                                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">{t('linkedShift')}</Label>
                            <Select value={newRule.config.linkedShiftId || ''} onValueChange={(v) => setNewRule({ ...newRule, config: { ...newRule.config, linkedShiftId: v } })}>
                              <SelectTrigger><SelectValue placeholder={t('selectShift')} /></SelectTrigger>
                              <SelectContent>
                                {getUserShiftsForRules(selectedUser).map((s: any) => (
                                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {newRule.type === 'MAX_LOAD' && (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">{t('shift')}</Label>
                              <Select value={newRule.config.shiftId || ''} onValueChange={(v) => setNewRule({ ...newRule, config: { ...newRule.config, shiftId: v } })}>
                                <SelectTrigger><SelectValue placeholder={t('selectShift')} /></SelectTrigger>
                                <SelectContent>
                                  {getUserShiftsForRules(selectedUser).map((s: any) => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">{t('maxPercentage')}</Label>
                              <Input
                                type="number"
                                min={1}
                                max={100}
                                value={newRule.config.maxPercentage ?? 50}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value, 10);
                                  setNewRule({ ...newRule, config: { ...newRule.config, maxPercentage: isNaN(v) ? 1 : Math.max(1, Math.min(100, v)) } });
                                }}
                              />
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 bg-blue-50 border-l-2 border-blue-300 px-2 py-1.5 rounded">
                            ℹ️ {t('maxLoadAnnualNote')}
                          </p>
                        </>
                      )}

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="hover:bg-secondary/20" onClick={() => { setIsAddingRule(false); setEditingRuleId(null); setNewRule({ type: 'WEEK_PARITY', config: { parity: 'odd' }, enabled: true }); }}>
                          {tCommon('cancel')}
                        </Button>
                        <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={handleSaveRule}>
                          {tCommon('save')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
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

        {/* Edit team dialog */}
        {selectedTeam && (
          <Dialog open={isEditTeamDialogOpen} onOpenChange={(open) => { setIsEditTeamDialogOpen(open); if (!open) setValidationErrors({}); }}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("editTeam")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>{t("teamName")}</Label>
                  <Input
                    value={selectedTeam.name}
                    onChange={(e) => { setSelectedTeam({...selectedTeam, name: e.target.value}); setValidationErrors(prev => ({...prev, editTeamName: false})); }}
                    className={validationErrors.editTeamName ? 'border-red-400 ring-2 ring-red-100 shadow-[0_0_8px_rgba(239,68,68,0.15)]' : ''}
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

                {/* Team members management */}
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

        {/* Create pattern dialog */}
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

              {/* User selection to view their shifts */}
              {users.filter(u => u.status === 'ACTIVE').length > 0 && (
              <div>
                <Label>{t("basedOnUserShifts")}</Label>
                <Select
                  value={patternUserId || undefined}
                  onValueChange={(uid) => {
                    setPatternUserId(uid);
                    const user = users.find(u => u.id === uid);
                    if (user) {
                      const userShifts = shifts.filter((shift: any) => {
                        const userInTeam = user.teamId === shift.teamId;
                        const userIncluded = shift.includedUserIds?.includes(uid);
                        const userExcluded = shift.excludedUserIds?.includes(uid);
                        return (userInTeam && !userExcluded) || userIncluded;
                      });
                      const userPiketts = piketts.filter((pikett: any) => {
                        const inTeam = user.teamId === pikett.teamId;
                        const included = pikett.includedUserIds?.includes(uid);
                        const excluded = pikett.excludedUserIds?.includes(uid);
                        return (inTeam && !excluded) || included;
                      });
                      setNewPattern({
                        ...newPattern,
                        userShifts: [...userShifts.map((s: any) => s.id), ...userPiketts.map((p: any) => p.id)]
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
              )}

              {/* Week configuration with actual shifts and availability taken into account */}
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
                          const patternUser = patternUserId ? users.find(u => u.id === patternUserId) : null;
                          const userAvailability = patternUser?.availability;
                          const dayAvail = userAvailability ? userAvailability[day as keyof WeekAvailability] : null;
                          const hasMorning = dayAvail?.morning === true;
                          const hasAfternoon = dayAvail?.afternoon === true;
                          const isDayAvailable = userAvailability ? (hasMorning || hasAfternoon) : true;

                          // Filter by availability; <25% overlap treated as single-period
                          const findShiftOrPikettById = (sid: string) => shifts.find((s: any) => s.id === sid) || piketts.find((p: any) => p.id === sid);
                          const availableShifts = (newPattern.userShifts || []).map(sid => findShiftOrPikettById(sid)).filter(Boolean).filter((item: any) => {
                            if (!item.startTime) return true;
                            if (!userAvailability || !dayAvail) return true;
                            const [startH, startM] = (item.startTime || '0:0').split(':').map(Number);
                            const [endH, endM] = (item.endTime || '0:0').split(':').map(Number);
                            const startMinutes = startH * 60 + (startM || 0);
                            const endMinutes = endH * 60 + (endM || 0);
                            const midday = 13 * 60;
                            if (endMinutes <= midday) return hasMorning;
                            if (startMinutes >= midday) return hasAfternoon;
                            const morningPortion = midday - startMinutes;
                            const afternoonPortion = endMinutes - midday;
                            const totalDuration = endMinutes - startMinutes;
                            const minorPortion = Math.min(morningPortion, afternoonPortion);
                            if (totalDuration > 0 && minorPortion / totalDuration < 0.25) {
                              return afternoonPortion > morningPortion ? hasAfternoon : hasMorning;
                            }
                            return hasMorning && hasAfternoon;
                          });

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
                                disabled={!isDayAvailable || availableShifts.length === 0}
                              >
                                <SelectTrigger className={`w-full h-auto text-xs ${
                                  (!isDayAvailable || availableShifts.length === 0) ? 'opacity-50 bg-slate-100 cursor-not-allowed' : ''
                                }`}>
                                  <SelectValue>
                                    {!isDayAvailable ? (
                                      <span className="text-slate-400">{t("unavailableShort")}</span>
                                    ) : availableShifts.length === 0 ? (
                                      <span className="text-slate-400">{t("unavailableShort")}</span>
                                    ) : week[day]?.[0] ? (
                                      <span className="truncate">
                                        {(shifts.find(s => s.id === week[day][0]) || piketts.find(p => p.id === week[day][0]))?.name || 'Shift'}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">{t("free")}</span>
                                    )}
                                  </SelectValue>
                                </SelectTrigger>
                                {isDayAvailable && availableShifts.length > 0 && (
                                  <SelectContent>
                                    <SelectItem value="none">
                                      <span className="text-slate-400">{t("free")}</span>
                                    </SelectItem>
                                      {availableShifts.map((item: any) => (
                                          <SelectItem key={item.id} value={item.id}>
                                            <div className="flex items-center gap-2">
                                              <div
                                                className="w-2 h-2 rounded-full"
                                                style={{ backgroundColor: item.color }}
                                              />
                                              <span>{item.name}</span>
                                              <span className="text-xs text-slate-500">
                                                {item.startTime ? `(${item.startTime}-${item.endTime})` : '(Pikett)'}
                                              </span>
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
                  setPatternUserId(null);
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
                      await updatePattern({...newPattern, userShifts: newPattern.userShifts || []} as any);
                    } else {
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

        {/* Pattern deletion confirmation dialog */}
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

        {/* User deletion confirmation dialog */}
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

        {/* Team deletion confirmation dialog */}
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

        {/* Custom error dialog */}
        <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                Error
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