'use client';

//app/shifts/page.tsx

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navigation from '@/components/Navigation';
import { useTranslations } from 'next-intl';
import {
  Clock,
  Plus,
  Edit,
  Trash2,
  Users,
  Calendar,
  Search,
  Filter,
  MoreHorizontal,
  Copy,
  Star,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Save,
  UserPlus,
  UserMinus,
  X,
  CalendarDays,
  Shield,
  Info,
  AlertTriangle,
  Building2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

// Import des hooks pour les vraies données
import { useShifts } from '@/lib/hooks/useShifts';
import { useTeams } from '@/lib/hooks/useTeams';
import { useUsers } from '@/lib/hooks/useUsers';
import { usePiketts } from '@/lib/hooks/usePiketts';

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

const ShiftsPage = () => {
  const t = useTranslations('shifts');
  const tCommon = useTranslations('common');
  const [viewType, setViewType] = useState<'shifts' | 'piketts'>('shifts');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreatePikettDialogOpen, setIsCreatePikettDialogOpen] = useState(false);
  const [isEditPikettDialogOpen, setIsEditPikettDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTeam, setFilterTeam] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [selectedPikett, setSelectedPikett] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteShiftId, setDeleteShiftId] = useState<string | null>(null);
  const [isDeleteShiftDialogOpen, setIsDeleteShiftDialogOpen] = useState(false);
  const [deletePikettId, setDeletePikettId] = useState<string | null>(null);
  const [isDeletePikettDialogOpen, setIsDeletePikettDialogOpen] = useState(false);

  // Utilisation du hook pour les piketts
  const {
    piketts,
    loading: pikettsLoading,
    error: pikettsError,
    createPikett,
    updatePikett: updatePikettHook,
    deletePikett: deletePikettHook,
    refetch: refetchPiketts
  } = usePiketts();

  // Utilisation des hooks pour les vraies données
  const { 
    shifts, 
    loading: shiftsLoading, 
    error: shiftsError, 
    createShift, 
    updateShift, 
    deleteShift,
    refetch: refetchShifts 
  } = useShifts();
  
  const { 
    teams, 
    loading: teamsLoading,
    error: teamsError 
  } = useTeams();

  const { 
    users, 
    loading: usersLoading,
    error: usersError 
  } = useUsers();

  const [newShift, setNewShift] = useState<any>({
    name: '',
    description: '',
    startTime: '',
    endTime: '',
    teamId: '',
    includedUserIds: [] as string[],
    excludedUserIds: [] as string[],
    color: '#3b82f6',
    daysOfWeek: [1, 2, 3, 4, 5]
  });

  const [newPikett, setNewPikett] = useState({
    id: '',
    name: '',
    description: '',
    teamId: '',
    includedUserIds: [] as string[],
    excludedUserIds: [] as string[],
    color: '#dc2626',
    status: 'ACTIVE',
    is24_7: true,
    daysOfWeek: [1, 2, 3, 4, 5]
  });

  const getStatusBadge = (status: string) => {
    return (
      <Badge 
        variant={status === 'ACTIVE' ? 'default' : 'secondary'}
        className={status === 'ACTIVE' ? 'bg-green-100 text-green-800 border-0' : 'bg-slate-100 text-slate-600 border-0'}
      >
        {status === 'ACTIVE' ? tCommon("active") : tCommon("inactive")}
      </Badge>
    );
  };

  const handleCreateShift = async () => {
    if (!newShift.name || !newShift.teamId || !newShift.startTime || !newShift.endTime) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setIsSubmitting(true);
    try {
      await createShift({
        ...newShift,
        membersRequired: 1,
        priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        daysOfWeek: newShift.daysOfWeek
      });
      
      setIsCreateDialogOpen(false);
      setNewShift({
        name: '',
        description: '',
        startTime: '',
        endTime: '',
        teamId: '',
        includedUserIds: [],
        excludedUserIds: [],
        color: '#3b82f6'
      });
    } catch (error) {
      console.error('Erreur lors de la création:', error);
      alert('Erreur lors de la création du shift');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreatePikett = async () => {
    if (!newPikett.name || !newPikett.teamId) {
      alert('Veuillez remplir le nom et sélectionner une équipe');
      return;
    }

    setIsSubmitting(true);
    try {
      await createPikett({
        name: newPikett.name,
        description: newPikett.description,
        teamId: newPikett.teamId,
        includedUserIds: newPikett.includedUserIds,
        excludedUserIds: newPikett.excludedUserIds,
        color: newPikett.color,
        status: newPikett.status,
        is24_7: newPikett.is24_7,
        startWeek: '',
        daysOfWeek: newPikett.daysOfWeek
      });
      
      setIsCreatePikettDialogOpen(false);
      setNewPikett({
        id: '',
        name: '',
        description: '',
        teamId: '',
        includedUserIds: [],
        excludedUserIds: [],
        color: '#dc2626',
        status: 'ACTIVE',
        is24_7: true,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6]
      });
    } catch (error) {
      console.error('Erreur lors de la création du pikett:', error);
      alert('Erreur lors de la création du pikett');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditPikett = async () => {
    if (!selectedPikett) return;

    setIsSubmitting(true);
    try {
      await updatePikettHook(selectedPikett.id, {
        name: selectedPikett.name,
        description: selectedPikett.description,
        teamId: selectedPikett.teamId,
        includedUserIds: selectedPikett.includedUserIds,
        excludedUserIds: selectedPikett.excludedUserIds,
        color: selectedPikett.color,
        status: selectedPikett.status,
        is24_7: selectedPikett.is24_7,
        daysOfWeek: selectedPikett.daysOfWeek
      });
      
      setIsEditPikettDialogOpen(false);
      setSelectedPikett(null);
    } catch (error) {
      console.error('Erreur lors de la modification du pikett:', error);
      alert('Erreur lors de la modification du pikett');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePikett = async () => {
    if (!deletePikettId) return;

    try {
      await deletePikettHook(deletePikettId);
      setIsDeletePikettDialogOpen(false);
      setDeletePikettId(null);
    } catch (error) {
      console.error('Erreur lors de la suppression du pikett:', error);
      alert('Erreur lors de la suppression du pikett');
    }
  };

  const handleEditShift = async () => {
    if (!selectedShift) return;

    setIsSubmitting(true);
    try {
      await updateShift(selectedShift.id, {
        name: selectedShift.name,
        description: selectedShift.description,
        startTime: selectedShift.startTime,
        endTime: selectedShift.endTime,
        teamId: selectedShift.teamId,
        membersRequired: 1,
        priority: 'MEDIUM',
        status: selectedShift.status,
        color: selectedShift.color,
        daysOfWeek: selectedShift.daysOfWeek
      });
      
      setIsEditDialogOpen(false);
      setSelectedShift(null);
    } catch (error) {
      console.error('Erreur lors de la modification:', error);
      alert('Erreur lors de la modification du shift');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteShift = async () => {
    if (!deleteShiftId) return;

    try {
      await deleteShift(deleteShiftId);
      setIsDeleteShiftDialogOpen(false);
      setDeleteShiftId(null);
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression du shift');
    }
  };

  const handleDuplicateShift = async (shift: any) => {
    try {
      await createShift({
        name: `${shift.name} (Copie)`,
        description: shift.description,
        startTime: shift.startTime,
        endTime: shift.endTime,
        teamId: shift.teamId,
        membersRequired: 1,
        priority: 'MEDIUM',
        color: shift.color,
      });
    } catch (error) {
      console.error('Erreur lors de la duplication:', error);
      alert('Erreur lors de la duplication du shift');
    }
  };

  const filteredShifts = shifts.filter(shift => {
    const matchesSearch = shift.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (shift.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesTeam = filterTeam === 'all' || shift.teamId === filterTeam;
    const matchesStatus = filterStatus === 'all' || shift.status === filterStatus;
    
    return matchesSearch && matchesTeam && matchesStatus;
  });

  const filteredPiketts = piketts.filter(pikett => {
    const matchesSearch = pikett.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (pikett.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesTeam = filterTeam === 'all' || pikett.teamId === filterTeam;
    const matchesStatus = filterStatus === 'all' || pikett.status === filterStatus;
    
    return matchesSearch && matchesTeam && matchesStatus;
  });

  const calculateDuration = (start: string, end: string) => {
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    
    let duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    if (duration < 0) duration += 24 * 60;
    
    return Math.round(duration / 60 * 10) / 10;
  };

  // Composant pour sélectionner les jours de la semaine
  const DaysOfWeekSelector = ({ 
    selectedDays, 
    onChange 
  }: { 
    selectedDays: number[], 
    onChange: (days: number[]) => void 
  }) => {
    const days = [
      { value: 1, label: t("mon") },
      { value: 2, label: t("tue") },
      { value: 3, label: t("wed") },
      { value: 4, label: t("thu") },
      { value: 5, label: t("fri") },
      { value: 6, label: t("sat") },
      { value: 0, label: t("sun") }
    ];

    const handleDayToggle = (dayValue: number) => {
      if (selectedDays.includes(dayValue)) {
        onChange(selectedDays.filter(d => d !== dayValue));
      } else {
        onChange([...selectedDays, dayValue].sort());
      }
    };

    return (
      <div className="space-y-2">
        <Label>{t("daysOfWeek")}</Label>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => (
            <div key={day.value}>
              <input
                type="checkbox"
                id={`day-shift-${day.value}`}
                checked={selectedDays.includes(day.value)}
                onChange={() => handleDayToggle(day.value)}
                className="sr-only"
              />
              <label
                htmlFor={`day-shift-${day.value}`}
                className={`flex items-center justify-center p-2 rounded cursor-pointer border-2 text-xs
                  ${selectedDays.includes(day.value)
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-slate-100 text-slate-600 border-slate-200'}`}
              >
                {day.label}
              </label>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          {t("selectDaysForShift")}
        </p>
      </div>
    );
  };

  // Composant pour gérer les membres du shift
  const MembersSelector = ({ 
    selectedUserIds, 
    excludedUserIds,
    onIncludeChange, 
    onExcludeChange,
    teamId 
  }: { 
    selectedUserIds: string[], 
    excludedUserIds: string[],
    onIncludeChange: (userIds: string[]) => void,
    onExcludeChange: (userIds: string[]) => void,
    teamId: string 
  }) => {
    const baseTeamUsers = users.filter(u => u.teamId === teamId && u.status === 'ACTIVE');
    const otherTeamUsers = users.filter(u => u.teamId !== teamId && u.status === 'ACTIVE');
    
    const effectiveTeamMembers = [
      ...baseTeamUsers.filter(u => !excludedUserIds.includes(u.id)),
      ...otherTeamUsers.filter(u => selectedUserIds.includes(u.id))
    ];
    
    const availableUsers = [
      ...otherTeamUsers.filter(u => !selectedUserIds.includes(u.id)),
      ...baseTeamUsers.filter(u => excludedUserIds.includes(u.id))
    ];

    const handleRemoveFromShift = (userId: string) => {
      const user = users.find(u => u.id === userId);
      if (!user) return;
      
      if (user.teamId === teamId) {
        onExcludeChange([...excludedUserIds, userId]);
      } else {
        onIncludeChange(selectedUserIds.filter(id => id !== userId));
      }
    };

    const handleAddToShift = (userId: string) => {
      const user = users.find(u => u.id === userId);
      if (!user) return;
      
      if (user.teamId === teamId) {
        onExcludeChange(excludedUserIds.filter(id => id !== userId));
      } else {
        onIncludeChange([...selectedUserIds, userId]);
      }
    };

    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">{t("assignedMembers")}</Label>
            <Badge variant="outline" className="text-xs">
              {effectiveTeamMembers.length} {t("memberCount")}
            </Badge>
          </div>
          <div className="border rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto bg-green-50/30">
            {effectiveTeamMembers.length > 0 ? (
              effectiveTeamMembers.map(user => (
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
                        {user.teamId !== teamId && (
                          <Badge variant="outline" className="text-xs">
                            {user.team?.name || t("otherTeam")}
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
                    onClick={() => handleRemoveFromShift(user.id)}
                  >
                    <UserMinus className="w-3 h-3" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">
                Aucun membre assigné à ce shift
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">{t("availableUsers")}</Label>
            <Badge variant="outline" className="text-xs">
              {availableUsers.length} {t("available")}
            </Badge>
          </div>
          <div className="border rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
            {availableUsers.length > 0 ? (
              availableUsers.map(user => {
                const isExcluded = excludedUserIds.includes(user.id);
                return (
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
                          {isExcluded && (
                            <Badge variant="destructive" className="text-xs">
                              Exclu
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-green-600 hover:bg-secondary/20"
                      onClick={() => handleAddToShift(user.id)}
                    >
                      <UserPlus className="w-3 h-3" />
                    </Button>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">
                Tous les utilisateurs sont déjà assignés
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const ShiftCard = ({ shift }: { shift: any }) => (
    <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div 
              className="w-3 h-8 rounded-full"
              style={{ backgroundColor: shift.color }}
            ></div>
            <div>
              <CardTitle className="text-lg font-semibold text-slate-800">
                {shift.name}
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">{shift.description}</p>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <div>
              <p className="text-sm font-medium text-slate-800">
                {shift.startTime} - {shift.endTime}
              </p>
              <p className="text-xs text-slate-500">
                {calculateDuration(shift.startTime, shift.endTime)}h
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-slate-500" />
            <div>
              <p className="text-sm font-medium text-slate-800">
                {shift.team?.name}
              </p>
              <p className="text-xs text-slate-500">
                {shift.excludedUserIds?.length || 0} {t("exclusions")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {getStatusBadge(shift.status)}
        </div>

        <div className="flex items-center space-x-2 pt-3 border-t">
          <Button
            onClick={() => {
              setSelectedShift({
                ...shift,
                includedUserIds: shift.includedUserIds || [],
                excludedUserIds: shift.excludedUserIds || [],
                daysOfWeek: shift.daysOfWeek || [1, 2, 3, 4, 5]
              });
              setIsEditDialogOpen(true);
            }}
            variant="outline"
            size="sm"
            className="flex-1 hover:bg-secondary/20"
          >
            <Edit className="w-4 h-4 mr-1" />
            {t("editShift")}
          </Button>
          <Button
            onClick={() => handleDuplicateShift(shift)}
            variant="outline"
            size="sm"
            className="hover:bg-secondary/20"
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => {
              setDeleteShiftId(shift.id);
              setIsDeleteShiftDialogOpen(true);
            }}
            variant="outline"
            size="sm"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const PikettCard = ({ pikett }: { pikett: any }) => {
    const team = teams.find(t => t.id === pikett.teamId);
    
    // Obtenir les utilisateurs éligibles
    const eligibleUsers = [
      ...users.filter(u => u.teamId === pikett.teamId && u.status === 'ACTIVE' && !pikett.excludedUserIds?.includes(u.id)),
      ...users.filter(u => pikett.includedUserIds?.includes(u.id) && u.status === 'ACTIVE')
    ];
    
    return (
      <Card className="bg-white border-0 shadow-sm hover:shadow-md transition-all duration-300">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div 
                className="w-3 h-8 rounded-full"
                style={{ backgroundColor: pikett.color }}
              ></div>
              <div>
                <CardTitle className="text-lg font-semibold text-slate-800">
                  {pikett.name}
                </CardTitle>
                <p className="text-sm text-slate-600 mt-1">{pikett.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-600" />
              {pikett.is24_7 && (
                <Badge className="bg-red-100 text-red-800 border-0 text-xs">
                  24/7
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <CalendarDays className="w-4 h-4 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {t("continuousPikett")}
                </p>
                <p className="text-xs text-slate-500">
                  {t("configuredInPlanner")}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {team?.name}
                </p>
                <p className="text-xs text-slate-500">
                  {eligibleUsers.length} {t("persons")}
                </p>
              </div>
            </div>
          </div>

          {/* Liste des utilisateurs assignés */}
          {eligibleUsers.length > 0 && (
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-xs font-medium text-red-800 mb-2">{t("eligiblePersonnel")}:</p>
              <div className="space-y-1">
                {eligibleUsers.slice(0, 3).map(user => (
                  <div key={user.id} className="flex items-center space-x-2">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-xs bg-gradient-to-br from-red-500 to-red-600 text-white">
                        {user.firstName[0]}{user.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-slate-700">{user.firstName} {user.lastName}</span>
                  </div>
                ))}
                {eligibleUsers.length > 3 && (
                  <p className="text-xs text-slate-500 italic">+{eligibleUsers.length - 3} {t("others")}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            {getStatusBadge(pikett.status)}
          </div>

          <Alert className="border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800 text-xs">
              {t("onCallService")} {pikett.is24_7 ? t("24_7") : t("accordingToSchedule")}.
              {t("datesAndRotationsManagedInPlanner")}
            </AlertDescription>
          </Alert>

          <div className="flex items-center space-x-2 pt-3 border-t">
            <Button
              onClick={() => {
                setSelectedPikett({...pikett});
                setIsEditPikettDialogOpen(true);
              }}
              variant="outline"
              size="sm"
              className="flex-1 hover:bg-secondary/20"
            >
              <Edit className="w-4 h-4 mr-1" />
              {t("editPikett")}
            </Button>
            <Button
              onClick={() => {
                setDeletePikettId(pikett.id);
                setIsDeletePikettDialogOpen(true);
              }}
              variant="outline"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (shiftsLoading || teamsLoading || usersLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (shiftsError || teamsError || usersError) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navigation />
        <div className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Erreur lors du chargement des données.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      
      <main className="p-6 space-y-6">
        {/* Header avec toggle */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              {viewType === 'shifts' ? t("title") : t("pikettManagement")}
            </h1>
            <p className="text-slate-600 mt-1">
              {viewType === 'shifts'
                ? t("subtitle")
                : t("pikettSubtitle")}
            </p>
          </div>
        </div>
          <div className="flex items-center space-x-3">
            {/* Toggle Shifts/Piketts */}
            <div className="flex items-center space-x-4">
              <Button
                variant={viewType === 'shifts' ? 'default' : 'outline'}
                onClick={() => setViewType('shifts')}
                className={viewType === 'shifts' ? 'bg-primary hover:bg-primary/90' : ''}
                size="lg"
              >
                <Clock className="w-5 h-5 mr-2" />
                Shifts
                <Badge variant="secondary" className="ml-2">
                  {shifts.length}
                </Badge>
              </Button>
              <Button
                variant={viewType === 'piketts' ? 'default' : 'outline'}
                onClick={() => setViewType('piketts')}
                className={viewType === 'piketts' ? 'bg-red-600 hover:bg-red-700' : ''}
                size="lg"
              >
                <Shield className="w-5 h-5 mr-2" />
                Piketts
                <Badge variant="secondary" className="ml-2">
                  {piketts.length}
                </Badge>
              </Button>
            </div>
            
            {viewType === 'piketts' ? (
              <Dialog open={isCreatePikettDialogOpen} onOpenChange={setIsCreatePikettDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-red-600 hover:bg-red-700">
                    <Plus className="w-4 h-4 mr-2" />
                    {t("newPikett")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{t("createPikett")}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>{t("pikettName")} *</Label>
                      <Input
                        placeholder={t("pikettNamePlaceholder")}
                        value={newPikett.name}
                        onChange={(e) => setNewPikett({...newPikett, name: e.target.value})}
                      />
                    </div>
                    
                    <div>
                      <Label>{tCommon("description")}</Label>
                      <Textarea
                        placeholder="Description du pikett..."
                        value={newPikett.description}
                        onChange={(e) => setNewPikett({...newPikett, description: e.target.value})}
                      />
                    </div>
                    
                    <div>
                      <Label>{tCommon("team")} *</Label>
                      <Select 
                        value={newPikett.teamId} 
                        onValueChange={(value) => setNewPikett({...newPikett, teamId: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("selectTeam")} />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map((team) => (
                            <SelectItem key={team.id} value={team.id}>
                              {team.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <DaysOfWeekSelector
                      selectedDays={newPikett.daysOfWeek}
                      onChange={(days) => setNewPikett({...newPikett, daysOfWeek: days})}
                    />
                    
                    {newPikett.teamId && (
                      <>
                        <MembersSelector
                          selectedUserIds={newPikett.includedUserIds}
                          excludedUserIds={newPikett.excludedUserIds}
                          onIncludeChange={(ids) => setNewPikett({...newPikett, includedUserIds: ids})}
                          onExcludeChange={(ids) => setNewPikett({...newPikett, excludedUserIds: ids})}
                          teamId={newPikett.teamId}
                        />
                      </>
                    )}                    
                    <div className="flex justify-end space-x-3">
                      <Button variant="outline" onClick={() => setIsCreatePikettDialogOpen(false)} className="hover:bg-secondary/20">
                        {tCommon("cancel")}
                      </Button>
                      <Button
                        onClick={handleCreatePikett}
                        className="bg-red-600 hover:bg-red-700"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("creating")}</>
                        ) : (
                          t("createPikett")
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90">
                    <Plus className="w-4 h-4 mr-2" />
                    {t("newShift")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{t("createShift")}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    {/* Contenu existant du dialog de création de shift */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>{t("shiftName")}</Label>
                        <Input
                          placeholder={t("shiftNamePlaceholder")}
                          value={newShift.name}
                          onChange={(e) => setNewShift({...newShift, name: e.target.value})}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>{tCommon("description")}</Label>
                        <Textarea
                          placeholder={t("shiftDescriptionPlaceholder")}
                          value={newShift.description}
                          onChange={(e) => setNewShift({...newShift, description: e.target.value})}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{t("startTime")}</Label>
                          <Input
                            type="time"
                            value={newShift.startTime}
                            onChange={(e) => setNewShift({...newShift, startTime: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("endTime")}</Label>
                          <Input
                            type="time"
                            value={newShift.endTime}
                            onChange={(e) => setNewShift({...newShift, endTime: e.target.value})}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>{tCommon("team")}</Label>
                        <Select value={newShift.teamId} onValueChange={(value) => setNewShift({...newShift, teamId: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("selectTeam")} />
                          </SelectTrigger>
                          <SelectContent>
                            {teams.map((team) => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <DaysOfWeekSelector
                        selectedDays={newShift.daysOfWeek}
                        onChange={(days) => setNewShift({...newShift, daysOfWeek: days})}
                      />

                      <div className="space-y-2">
                        <Label>{t("shiftColor")}</Label>
                        <div className="flex items-center space-x-2">
                          {SHIFT_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className={`w-8 h-8 rounded-lg border-2 ${
                                newShift.color === color ? 'border-slate-800' : 'border-slate-200'
                              }`}
                              style={{ backgroundColor: color }}
                              onClick={() => setNewShift({...newShift, color})}
                            />
                          ))}
                        </div>
                      </div>

                      {newShift.teamId && (
                        <MembersSelector
                          selectedUserIds={newShift.includedUserIds}
                          excludedUserIds={newShift.excludedUserIds}
                          onIncludeChange={(ids) => setNewShift({...newShift, includedUserIds: ids})}
                          onExcludeChange={(ids) => setNewShift({...newShift, excludedUserIds: ids})}
                          teamId={newShift.teamId}
                        />
                      )}
                    </div>
                    
                    <div className="flex justify-end space-x-3">
                      <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="hover:bg-secondary/20">
                        {tCommon("cancel")}
                      </Button>
                      <Button
                        onClick={handleCreateShift}
                        disabled={isSubmitting || !newShift.name || !newShift.teamId || !newShift.startTime || !newShift.endTime}
                        className="bg-primary hover:bg-primary/90"
                      >
                        {isSubmitting ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("creating")}</>
                        ) : (
                          t("createShift")
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        

        {/* Dialog de modification de pikett */}
        {selectedPikett && (
          <Dialog open={isEditPikettDialogOpen} onOpenChange={setIsEditPikettDialogOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("editPikett")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>{t("pikettName")}</Label>
                  <Input
                    value={selectedPikett.name}
                    onChange={(e) => setSelectedPikett({...selectedPikett, name: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label>{tCommon("description")}</Label>
                  <Textarea
                    value={selectedPikett.description || ''}
                    onChange={(e) => setSelectedPikett({...selectedPikett, description: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label>{tCommon("team")}</Label>
                  <Select 
                    value={selectedPikett.teamId} 
                    onValueChange={(value) => setSelectedPikett({...selectedPikett, teamId: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <DaysOfWeekSelector
                  selectedDays={selectedPikett?.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]}
                  onChange={(days) => setSelectedPikett({...selectedPikett, daysOfWeek: days})}
                />
                
                <div>
                  <Label>{t("eligiblePersonnel")}</Label>
                  <MembersSelector
                    selectedUserIds={selectedPikett?.includedUserIds || []}
                    excludedUserIds={selectedPikett?.excludedUserIds || []}
                    onIncludeChange={(ids) => setSelectedPikett({...selectedPikett, includedUserIds: ids})}
                    onExcludeChange={(ids) => setSelectedPikett({...selectedPikett, excludedUserIds: ids})}
                    teamId={selectedPikett?.teamId || ''}
                  />
                </div>
                
                <div className="flex justify-end space-x-3">
                  <Button variant="outline" onClick={() => setIsEditPikettDialogOpen(false)} className="hover:bg-secondary/20">
                    {tCommon("cancel")}
                  </Button>
                  <Button
                    onClick={handleEditPikett}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("saving")}</>
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

        {/* Dialog de modification de shift */}
        {selectedShift && (
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("editShift")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t("shiftName")}</Label>
                    <Input
                      value={selectedShift.name}
                      onChange={(e) => setSelectedShift({...selectedShift, name: e.target.value})}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>{tCommon("description")}</Label>
                    <Textarea
                      value={selectedShift.description || ''}
                      onChange={(e) => setSelectedShift({...selectedShift, description: e.target.value})}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("startTime")}</Label>
                      <Input
                        type="time"
                        value={selectedShift.startTime}
                        onChange={(e) => setSelectedShift({...selectedShift, startTime: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("endTime")}</Label>
                      <Input
                        type="time"
                        value={selectedShift.endTime}
                        onChange={(e) => setSelectedShift({...selectedShift, endTime: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>{tCommon("team")}</Label>
                    <Select 
                      value={selectedShift.teamId} 
                      onValueChange={(value) => setSelectedShift({...selectedShift, teamId: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <DaysOfWeekSelector
                    selectedDays={selectedShift.daysOfWeek || [1, 2, 3, 4, 5]}
                    onChange={(days) => setSelectedShift({...selectedShift, daysOfWeek: days})}
                  />

                  <div className="space-y-2">
                    <Label>{t("shiftColor")}</Label>
                    <div className="flex items-center space-x-2">
                      {SHIFT_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`w-8 h-8 rounded-lg border-2 ${
                            selectedShift.color === color ? 'border-slate-800' : 'border-slate-200'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setSelectedShift({...selectedShift, color})}
                        />
                      ))}
                    </div>
                  </div>

                  {selectedShift.teamId && (
                    <MembersSelector
                      selectedUserIds={selectedShift.includedUserIds || []}
                      excludedUserIds={selectedShift.excludedUserIds || []}
                      onIncludeChange={(ids) => setSelectedShift({...selectedShift, includedUserIds: ids})}
                      onExcludeChange={(ids) => setSelectedShift({...selectedShift, excludedUserIds: ids})}
                      teamId={selectedShift.teamId}
                    />
                  )}
                  
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select 
                      value={selectedShift.status} 
                      onValueChange={(value) => setSelectedShift({...selectedShift, status: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">{tCommon("active")}</SelectItem>
                        <SelectItem value="INACTIVE">{tCommon("inactive")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <Button variant="outline" onClick={() => {
                    setIsEditDialogOpen(false);
                    setSelectedShift(null);
                  }} className="hover:bg-secondary/20">
                    {tCommon("cancel")}
                  </Button>
                  <Button
                    onClick={handleEditShift}
                    disabled={isSubmitting}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("saving")}</>
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

        {/* Filters and Search */}
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder={viewType === 'shifts' ? t("searchShifts") : t("searchPiketts")}
                    className="pl-9 w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <Select value={filterTeam} onValueChange={setFilterTeam}>
                  <SelectTrigger className="w-auto">
                    <Building2 className="w-4 h-4 mr-2 text-slate-500" />
                    <SelectValue placeholder={tCommon("team")} />
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
                    <SelectValue placeholder={tCommon("status")} />
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
                        <span>Actifs</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="INACTIVE">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                        <span>Inactifs</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2 text-sm text-slate-600">
                <span>
                  {viewType === 'shifts' 
                    ? `${filteredShifts.length} shift${filteredShifts.length > 1 ? 's' : ''}`
                    : `${filteredPiketts.length} pikett${filteredPiketts.length > 1 ? 's' : ''}`}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contenu selon le type de vue */}
        {viewType === 'shifts' ? (
          filteredShifts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredShifts.map((shift) => (
                <ShiftCard key={shift.id} shift={shift} />
              ))}
            </div>
          ) : (
            <Card className="bg-white border-0 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Clock className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-800 mb-2">
                  {searchQuery || filterTeam !== 'all' || filterStatus !== 'all'
                    ? t("noShiftFound")
                    : t("noShiftConfigured")}
                </h3>
                <p className="text-slate-600 mb-6 max-w-md">
                  {searchQuery || filterTeam !== 'all' || filterStatus !== 'all' 
                    ? t("tryModifySearch")
                    : t("createFirstShift")}
                </p>
                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Créer un Shift
                </Button>
              </CardContent>
            </Card>
          )
        ) : (
          filteredPiketts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredPiketts.map((pikett) => (
                <PikettCard key={pikett.id} pikett={pikett} />
              ))}
            </div>
          ) : (
            <Card className="bg-white border-0 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <Shield className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-800 mb-2">
                  Aucun pikett configuré
                </h3>
                <p className="text-slate-600 mb-6 max-w-md">
                  Configurez les astreintes pour vos équipes.
                </p>
                <Button 
                  onClick={() => setIsCreatePikettDialogOpen(true)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Créer un Pikett
                </Button>
              </CardContent>
            </Card>
          )
        )}

        {/* Dialog de confirmation de suppression de shift */}
        <Dialog open={isDeleteShiftDialogOpen} onOpenChange={setIsDeleteShiftDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                {t("confirmDeletion")}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-slate-700">
                {t("deleteShiftConfirm")}
              </p>
              {deleteShiftId && (
                <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="font-medium text-red-800">
                    {shifts.find(s => s.id === deleteShiftId)?.name}
                  </p>
                  <p className="text-sm text-red-600 mt-1">
                    {t("deleteShiftDesc")}
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteShiftDialogOpen(false);
                  setDeleteShiftId(null);
                }}
                className="hover:bg-secondary/20"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                onClick={handleDeleteShift}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {tCommon("delete")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog de confirmation de suppression de pikett */}
        <Dialog open={isDeletePikettDialogOpen} onOpenChange={setIsDeletePikettDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                {t("confirmDeletion")}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-slate-700">
                {t("deletePikettConfirm")}
              </p>
              {deletePikettId && (
                <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="font-medium text-red-800">
                    {piketts.find(p => p.id === deletePikettId)?.name}
                  </p>
                  <p className="text-sm text-red-600 mt-1">
                    {t("deletePikettDesc")}
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeletePikettDialogOpen(false);
                  setDeletePikettId(null);
                }}
                className="hover:bg-secondary/20"
              >
                {tCommon("cancel")}
              </Button>
              <Button
                onClick={handleDeletePikett}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default function ShiftsPageProtected() {
  return <ProtectedRoute><ShiftsPage /></ProtectedRoute>;
}