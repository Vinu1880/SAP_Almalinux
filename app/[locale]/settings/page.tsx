'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navigation from '@/components/Navigation';
import { useTranslations } from 'next-intl';
import { 
  Settings, 
  Clock,
  Database,
  Save,
  RefreshCw,
  CheckCircle,
  Info,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  FileArchive,
  Loader2,
  Calendar,
  CalendarPlus,
  CalendarDays,
  MapPin,
  Plus,
  Edit2,
  Trash,
  FileDown,
  FileUp,
  Star
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useHolidays } from '@/lib/hooks/useHolidays';
import { useAuthFetch, useAuthReady } from '@/lib/hooks/useAuthFetch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// Types
interface Backup {
  fileName: string;
  date: string;
  size: string;
  counts: string;
}

interface Notification {
  message: string;
  type: 'success' | 'error' | 'info';
}

interface SettingItemProps {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}

const SettingsPage = () => {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const authFetch = useAuthFetch();
  const isReady = useAuthReady();
  const [settings, setSettings] = useState({
    balanceShifts: true,
    checkCalendars: true,
    prioritySystem: true,
    enableRotations: true
  });

  useEffect(() => {
    const saved = localStorage.getItem('shiftSettings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  const [backups, setBackups] = useState<Backup[]>([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isLoadingBackups, setIsLoadingBackups] = useState(true);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Scheduled backup states
  const [backupSchedule, setBackupSchedule] = useState({
    enabled: false,
    frequency: 'daily' as 'daily' | 'weekly' | 'monthly',
    hour: '02:00',
    dayOfWeek: 1, // Monday
    dayOfMonth: 1,
    maxBackups: 10,
  });

  // Load scheduled backup settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('backupSchedule');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migrate old format
      if (parsed.intervalHours && !parsed.frequency) {
        parsed.frequency = parsed.intervalHours <= 24 ? 'daily' : parsed.intervalHours <= 168 ? 'weekly' : 'monthly';
        parsed.hour = parsed.hour || '02:00';
        parsed.dayOfWeek = parsed.dayOfWeek || 1;
        parsed.dayOfMonth = parsed.dayOfMonth || 1;
        delete parsed.intervalHours;
      }
      setBackupSchedule(prev => ({ ...prev, ...parsed }));
    }
  }, []);

  // Delete confirmation dialog states
  const [deleteBackupFileName, setDeleteBackupFileName] = useState<string | null>(null);
  const [isDeleteBackupDialogOpen, setIsDeleteBackupDialogOpen] = useState(false);
  const [deleteHolidayId, setDeleteHolidayId] = useState<string | null>(null);
  const [isDeleteHolidayDialogOpen, setIsDeleteHolidayDialogOpen] = useState(false);

  // Holiday states
  const currentYear = new Date().getFullYear();
  const { 
    holidays,
    loading: holidaysLoading,
    createHoliday,
    updateHoliday,
    deleteHoliday,
    deleteAllHolidays,
    importCsvHolidays,
    importStandardHolidays
  } = useHolidays(currentYear);

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [isCreateHolidayDialogOpen, setIsCreateHolidayDialogOpen] = useState(false);
  const [isEditHolidayDialogOpen, setIsEditHolidayDialogOpen] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<any>(null);
  const [newHoliday, setNewHoliday] = useState({
    name: '',
    date: '',
    cantons: [] as string[],
    type: 'CUSTOM' as 'FEDERAL' | 'CANTONAL' | 'CUSTOM',
    recurring: false,
    description: ''
  });

  useEffect(() => {
    if (isReady) {
      loadBackups();
    }
  }, [isReady]);

  const loadBackups = async () => {
    setIsLoadingBackups(true);
    try {
      const response = await authFetch('/api/backup');
      if (response.ok) {
        const data = await response.json();
        setBackups(data);
      }
    } catch (error) {
      // Error loading backups - notification shown to user
      showNotification(t('loadBackupsError'), 'error');
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const handleSaveSettings = () => {
    setIsSaving(true);
    localStorage.setItem('shiftSettings', JSON.stringify(settings));
    setTimeout(() => {
      setIsSaving(false);
      showNotification(t('settingsSaved'), 'success');
    }, 1000);
  };

  const saveBackupSchedule = (newSchedule: typeof backupSchedule) => {
    setBackupSchedule(newSchedule);
    localStorage.setItem('backupSchedule', JSON.stringify(newSchedule));
  };

  const createBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const response = await authFetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxBackups: backupSchedule.maxBackups > 0 ? backupSchedule.maxBackups : 0 })
      });

      if (response.ok) {
        const result = await response.json();
        showNotification(t('backupCreated') + `: ${result.fileName}`, 'success');
        loadBackups();
      } else {
        throw new Error(t('backupError'));
      }
    } catch (error) {
      showNotification(t('backupError'), 'error');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const downloadBackup = async (fileName: string) => {
    try {
      const response = await authFetch(`/api/backup/download/${fileName}`);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showNotification(t('downloadError'), 'error');
    }
  };

  const deleteBackup = async () => {
    if (!deleteBackupFileName) return;

    try {
      const response = await authFetch(`/api/backup/${deleteBackupFileName}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showNotification(t('backupDeleted'), 'success');
        loadBackups();
      } else {
        const errorData = await response.json();
        showNotification(errorData.error || t('deleteError'), 'error');
      }
    } catch (error) {
      showNotification(error instanceof Error ? error.message : t('deleteError'), 'error');
    } finally {
      setIsDeleteBackupDialogOpen(false);
      setDeleteBackupFileName(null);
    }
  };

  const restoreBackup = async () => {
    if (!selectedBackup) return;
    
    setIsRestoring(true);
    try {
      const response = await authFetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: selectedBackup, confirmed: true })
      });
      
      if (response.ok) {
        showNotification(t('restoreSuccess'), 'success');
        setRestoreModalOpen(false);
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || t('restoreError'));
      }
    } catch (error) {
      showNotification(error instanceof Error ? error.message : t('restoreError'), 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate JSON file type
    if (!file.name.endsWith('.json')) {
      showNotification(t('fileMustBeJSON'), 'error');
      return;
    }

    // Ask for confirmation
    if (!confirm(t('confirmRestoreBackup'))) {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setIsUploading(true);
    try {
      // Read file content
      const fileContent = await file.text();
      const backupData = JSON.parse(fileContent);

      // Use the same API as restoring from the list
      const response = await authFetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...backupData, confirmed: true })
      });

      if (response.ok) {
        showNotification(t('restoreSuccess'), 'success');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        const error = await response.json();
        throw new Error(error.error || t('restoreError'));
      }
    } catch (error) {
      showNotification(
        error instanceof Error ? error.message : t('restoreFileError'),
        'error'
      );
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Holiday management functions
  const handleCreateHoliday = async () => {
    if (!newHoliday.name || !newHoliday.date || newHoliday.cantons.length === 0) {
      showNotification(t('fillAllFields'), 'error');
      return;
    }

    try {
      await createHoliday(newHoliday);
      showNotification(t('holidayCreated'), 'success');
      setIsCreateHolidayDialogOpen(false);
      setNewHoliday({
        name: '',
        date: '',
        cantons: [],
        type: 'CUSTOM',
        recurring: false,
        description: ''
      });
    } catch (error) {
      showNotification(t('holidayCreateError'), 'error');
    }
  };

  const handleEditHoliday = async () => {
    if (!selectedHoliday) return;

    try {
      await updateHoliday(selectedHoliday.id, selectedHoliday);
      showNotification(t('holidayUpdated'), 'success');
      setIsEditHolidayDialogOpen(false);
      setSelectedHoliday(null);
    } catch (error) {
      showNotification(t('holidayUpdateError'), 'error');
    }
  };

  const handleDeleteHoliday = async () => {
    if (!deleteHolidayId) return;

    try {
      await deleteHoliday(deleteHolidayId);
      showNotification(t('holidayDeleted'), 'success');
    } catch (error) {
      showNotification(t('holidayDeleteError'), 'error');
    } finally {
      setIsDeleteHolidayDialogOpen(false);
      setDeleteHolidayId(null);
    }
  };

  const [isImportingHolidays, setIsImportingHolidays] = useState(false);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [isDeletingAllHolidays, setIsDeletingAllHolidays] = useState(false);
  const [isDeleteAllHolidaysDialogOpen, setIsDeleteAllHolidaysDialogOpen] = useState(false);
  const csvFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImportStandardHolidays = async () => {
    const selectedCantons = ['BE', 'ZH', 'VD'];
    setIsImportingHolidays(true);

    try {
      const imported = await importStandardHolidays(selectedYear, selectedCantons);
      showNotification(t('holidaysImported').replace('{count}', imported.length.toString()), 'success');
    } catch (error) {
      showNotification(t('holidaysImportError'), 'error');
    } finally {
      setIsImportingHolidays(false);
    }
  };

  const handleImportCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportingCsv(true);
    try {
      const text = await file.text();
      const lines = text.trim().split('\n');
      if (lines.length < 2) {
        showNotification(t('csvEmptyError') || 'CSV file is empty or has no data rows', 'error');
        return;
      }

      // Parse header to find canton columns
      const header = lines[0].split(',').map(h => h.trim());
      const dateIdx = header.findIndex(h => h.toLowerCase() === 'date');
      const nameIdx = header.findIndex(h => h.toLowerCase() === 'name');
      if (dateIdx === -1 || nameIdx === -1) {
        showNotification(t('csvFormatError') || 'CSV must have "date" and "name" columns', 'error');
        return;
      }

      // Find canton columns (CH, BE, VD, ZH, etc.)
      const cantonColumns: { idx: number; code: string }[] = [];
      header.forEach((h, i) => {
        const upper = h.toUpperCase();
        if (['CH', 'BE', 'VD', 'ZH'].includes(upper)) {
          cantonColumns.push({ idx: i, code: upper });
        }
      });

      // Parse all rows into holiday objects
      const holidayList: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.length < Math.max(dateIdx, nameIdx) + 1) continue;

        const rawDate = cols[dateIdx];
        const name = cols[nameIdx];
        if (!rawDate || !name) continue;

        // Parse date (DD.MM.YYYY or YYYY-MM-DD)
        let isoDate: string;
        if (rawDate.includes('.')) {
          const [day, month, year] = rawDate.split('.');
          isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        } else {
          isoDate = rawDate;
        }

        // Determine cantons from TRUE/FALSE columns
        const cantons: string[] = [];
        let isCH = false;
        for (const cc of cantonColumns) {
          const val = cols[cc.idx]?.toUpperCase();
          if (val === 'TRUE' || val === '1' || val === 'YES') {
            if (cc.code === 'CH') {
              isCH = true;
            } else {
              cantons.push(cc.code);
            }
          }
        }

        if (cantons.length === 0) continue;
        const finalCantons = isCH ? ['CH', ...cantons] : cantons;
        const type = isCH ? 'FEDERAL' : 'CANTONAL';

        holidayList.push({ name, date: isoDate, cantons: finalCantons, type });
      }

      if (holidayList.length === 0) {
        showNotification(t('csvEmptyError') || 'No valid holidays found in CSV', 'error');
        return;
      }

      // Send all holidays in a single batch request
      const imported = await importCsvHolidays(holidayList);

      showNotification(
        (t('holidaysImported') || '{count} holidays imported').replace('{count}', imported.length.toString()),
        'success'
      );
    } catch (error) {
      showNotification(t('csvImportError') || 'Failed to import CSV', 'error');
    } finally {
      setIsImportingCsv(false);
      if (csvFileInputRef.current) csvFileInputRef.current.value = '';
    }
  };

  const handleDeleteAllHolidays = async () => {
    setIsDeletingAllHolidays(true);
    try {
      const count = await deleteAllHolidays(selectedYear);
      showNotification(t('holidaysDeleted')?.replace('{count}', count.toString()) || `${count} holidays deleted`, 'success');
      setIsDeleteAllHolidaysDialogOpen(false);
    } catch (error) {
      showNotification(t('holidaysDeleteError') || 'Error deleting holidays', 'error');
    } finally {
      setIsDeletingAllHolidays(false);
    }
  };

  const ALL_CANTONS = ['BE', 'ZH', 'VD'];

  const toggleCanton = (canton: string, isNewHoliday: boolean = true) => {
    const computeCantons = (prev: string[]) => {
      // Simple toggle — each checkbox is independent (CH is just a cosmetic badge)
      return prev.includes(canton)
        ? prev.filter(c => c !== canton)
        : [...prev, canton];
    };

    if (isNewHoliday) {
      setNewHoliday(prev => ({ ...prev, cantons: computeCantons(prev.cantons) }));
    } else if (selectedHoliday) {
      setSelectedHoliday((prev: any) => ({ ...prev, cantons: computeCantons(prev.cantons) }));
    }
  };

  const getCantonBadge = (canton: string) => {
    const colors: { [key: string]: string } = {
      'CH': 'bg-amber-100 text-amber-800',
      'BE': 'bg-red-100 text-red-800',
      'ZH': 'bg-blue-100 text-blue-800',
      'VD': 'bg-green-100 text-green-800'
    };

    const labels: { [key: string]: string } = {
      'CH': 'CH',
      'BE': t('cantonBerne'),
      'ZH': t('cantonZurich'),
      'VD': t('cantonVaud')
    };

    return (
      <Badge className={`${colors[canton] || 'bg-gray-100 text-gray-800'} border-0 text-xs`}>
        {labels[canton] || canton}
      </Badge>
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'FEDERAL':
        return <Star className="w-4 h-4 text-blue-600" />;
      case 'CANTONAL':
        return <MapPin className="w-4 h-4 text-green-600" />;
      default:
        return <CalendarDays className="w-4 h-4 text-purple-600" />;
    }
  };

  const filteredHolidays = holidays.filter(holiday => {
    const holidayYear = new Date(holiday.date).getFullYear();
    return holidayYear === selectedYear;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const SettingItem = ({ icon: Icon, title, description, children }: SettingItemProps) => (
    <div className="flex items-start space-x-4 p-4 rounded-lg border border-slate-200 bg-slate-50">
      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-blue-600" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-slate-800">{title}</h4>
            <p className="text-sm text-slate-600 mt-1">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      
      <main className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800">{t("title")}</h1>
        </div>

        {/* Notification */}
        {notification && (
          <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 flex items-center gap-2 ${
            notification.type === 'success' ? 'bg-green-100 text-green-800' : 
            notification.type === 'error' ? 'bg-red-100 text-red-800' : 
            'bg-blue-100 text-blue-800'
          }`}>
            {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : 
             notification.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : 
             <Info className="w-5 h-5" />}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Tabs pour organiser les paramètres */}
        <Tabs defaultValue="planning" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 ">
            <TabsTrigger value="planning" className="flex items-center gap-2 hover:bg-secondary/20">
              <Clock className="w-4 h-4" />
              {t("planning")}
            </TabsTrigger>
            <TabsTrigger value="holidays" className="flex items-center gap-2 hover:bg-secondary/20">
              <CalendarPlus className="w-4 h-4" />
              {t("holidaysTab")}
            </TabsTrigger>
            <TabsTrigger value="backup" className="flex items-center gap-2 hover:bg-secondary/20">
              <Database className="w-4 h-4" />
              {t("backupTab")}
            </TabsTrigger>
          </TabsList>

          {/* Onglet Règles de Planification */}
          <TabsContent value="planning">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center text-xl font-semibold text-slate-800">
                  <Clock className="w-5 h-5 mr-2 text-blue-600" />
                  {t("shiftRules")}
                </CardTitle>
                <p className="text-sm text-slate-600">
                  {t("shiftRulesDesc")}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <SettingItem
                  icon={Clock}
                  title={t("balanceShifts")}
                  description={t("balanceShiftsDesc")}
                >
                  <Switch
                    checked={settings.balanceShifts}
                    onCheckedChange={(checked) =>
                      setSettings({...settings, balanceShifts: checked})
                    }
                  />
                </SettingItem>

                <SettingItem
                  icon={Calendar}
                  title={t("checkCalendars")}
                  description={t("checkCalendarsDesc")}
                >
                  <Switch
                    checked={settings.checkCalendars}
                    onCheckedChange={(checked) => 
                      setSettings({...settings, checkCalendars: checked})
                    }
                  />
                </SettingItem>

                <SettingItem
                  icon={Settings}
                  title={t("prioritySystem")}
                  description={t("prioritySystemDesc")}
                >
                  <Switch
                    checked={settings.prioritySystem}
                    onCheckedChange={(checked) => 
                      setSettings({...settings, prioritySystem: checked})
                    }
                  />
                </SettingItem>

                <SettingItem
                  icon={RefreshCw}
                  title={t("enableRotations")}
                  description={t("enableRotationsDesc")}
                >
                  <Switch
                    checked={settings.enableRotations}
                    onCheckedChange={(checked) => 
                      setSettings({...settings, enableRotations: checked})
                    }
                  />
                </SettingItem>

                <div className="pt-4 flex justify-end">
                  <Button
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {isSaving ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("saving")}</>
                    ) : (
                      <><Save className="w-4 h-4 mr-2" /> {t("saveSettings")}</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Jours Fériés */}
          <TabsContent value="holidays">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center text-xl font-semibold text-slate-800">
                      <CalendarPlus className="w-5 h-5 mr-2 text-green-600" />
                      {t("holidaysTitle")}
                    </CardTitle>
                    <p className="text-sm text-slate-600 mt-1">
                      {t("holidaysDesc")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Select
                      value={selectedYear.toString()}
                      onValueChange={(value) => setSelectedYear(parseInt(value))}
                    >
                      <SelectTrigger className="w-auto">
                        <Calendar className="w-4 h-4 mr-2 text-slate-500" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 3 }, (_, i) => {
                          const year = currentYear + i;
                          return (
                            <SelectItem key={year} value={year.toString()}>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                <span>{year}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleImportStandardHolidays}
                      variant="outline"
                      size="sm"
                      disabled={isImportingHolidays}
                      className="hover:bg-secondary/20"
                    >
                      {isImportingHolidays ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <FileDown className="w-4 h-4 mr-2" />
                      )}
                      {t("importStandards")}
                    </Button>
                    <Button
                      onClick={() => csvFileInputRef.current?.click()}
                      variant="outline"
                      size="sm"
                      disabled={isImportingCsv}
                      className="hover:bg-secondary/20"
                    >
                      {isImportingCsv ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <FileUp className="w-4 h-4 mr-2" />
                      )}
                      {t("importCsv") || "Import CSV"}
                    </Button>
                    <input
                      ref={csvFileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleImportCsv}
                      className="hidden"
                    />
                    <Dialog open={isCreateHolidayDialogOpen} onOpenChange={setIsCreateHolidayDialogOpen}>
                      <Button
                        onClick={() => setIsCreateHolidayDialogOpen(true)}
                        className="bg-[#00ff7b] text-black hover:bg-secondary/20"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {t("newHoliday")}
                      </Button>
                    </Dialog>
                    {filteredHolidays.length > 0 && (
                      <Button
                        onClick={() => setIsDeleteAllHolidaysDialogOpen(true)}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-100 hover:text-red-700 border-red-200"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t("deleteAll") || "Delete all"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                {holidaysLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-green-600" />
                    <p className="text-slate-500">{t("loadingHolidays")}</p>
                  </div>
                ) : filteredHolidays.length === 0 ? (
                  <div className="text-center py-12">
                    <CalendarDays className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <h3 className="text-lg font-medium text-slate-800 mb-2">
                      {t("noHolidays").replace("{year}", selectedYear.toString())}
                    </h3>
                    <p className="text-slate-600 mb-6">
                      {t("noHolidaysDesc")}
                    </p>
                    <Button
                      onClick={() => setIsCreateHolidayDialogOpen(true)}
                      className="bg-[#00ff7b] text-black hover:bg-secondary/20"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {t("addHoliday")}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredHolidays.map(holiday => (
                      <div
                        key={holiday.id}
                        className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            {getTypeIcon(holiday.type)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h4 className="font-medium text-slate-800">{holiday.name}</h4>
                              <div className="flex gap-1">
                                {holiday.cantons.map(canton => getCantonBadge(canton))}
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-600">
                              <span>{new Date(holiday.date).toLocaleDateString('fr-FR', { 
                                weekday: 'long',
                                day: 'numeric', 
                                month: 'long',
                                year: 'numeric'
                              })}</span>
                              {holiday.description && (
                                <span className="text-slate-500">• {holiday.description}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => {
                              setSelectedHoliday({...holiday, date: holiday.date.split('T')[0]});
                              setIsEditHolidayDialogOpen(true);
                            }}
                            variant="outline"
                            size="sm"
                            className="hover:bg-secondary/20"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => {
                              setDeleteHolidayId(holiday.id);
                              setIsDeleteHolidayDialogOpen(true);
                            }}
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:bg-red-100"
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Base de données & Sauvegardes */}
          <TabsContent value="backup">
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center text-xl font-semibold text-slate-800">
                  <Database className="w-5 h-5 mr-2 text-green-600" />
                  {t("databaseAndBackups")}
                </CardTitle>
                <p className="text-sm text-slate-600">{t("backupDesc")}</p>
              </CardHeader>
              <CardContent>
                {/* Créer une sauvegarde */}
                <div className="mb-8">
                  <h3 className="font-semibold text-slate-700 mb-4">{t("backupTitle")}</h3>
                  <div className="flex gap-3">
                    <Button
                      onClick={createBackup}
                      disabled={isCreatingBackup}
                      className="bg-[#00ff7b] text-black hover:bg-secondary/20"
                    >
                      {isCreatingBackup ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("creatingBackup")}</>
                      ) : (
                        <><Download className="w-4 h-4 mr-2" /> {t("createBackup")}</>
                      )}
                    </Button>

                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="backup-file-input"
                      />
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        variant="outline"
                        className="border-orange-600 text-orange-600 hover:bg-orange-50"
                      >
                        {isUploading ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("restoring")}</>
                        ) : (
                          <><Upload className="w-4 h-4 mr-2" /> {t("importBackup")}</>
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mt-2">
                    {t("backupInstructions")}
                  </p>
                </div>

                {/* Backup Schedule & Rotation Settings */}
                <div className="mb-8 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {t("backupRotation")}
                  </h3>
                  <div className="space-y-4">
                    {/* Toggle */}
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium text-slate-700">{t("scheduledBackup")}</Label>
                        <p className="text-xs text-slate-500">{t("scheduledBackupDesc")}</p>
                      </div>
                      <Switch
                        checked={backupSchedule.enabled}
                        onCheckedChange={(checked) => saveBackupSchedule({ ...backupSchedule, enabled: checked })}
                      />
                    </div>

                    {backupSchedule.enabled && (
                      <>
                        {/* Frequency */}
                        <div className="flex items-center gap-3">
                          <Label className="text-sm text-slate-600 whitespace-nowrap">{t("backupFrequency")}</Label>
                          <div className="flex gap-1 bg-white border rounded-md p-0.5">
                            {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                              <button
                                key={freq}
                                onClick={() => saveBackupSchedule({ ...backupSchedule, frequency: freq })}
                                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                                  backupSchedule.frequency === freq
                                    ? 'bg-[#00ff7b] text-black font-medium'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                {t(`backupFreq${freq.charAt(0).toUpperCase() + freq.slice(1)}`)}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Day of week (for weekly) */}
                        {backupSchedule.frequency === 'weekly' && (
                          <div className="flex items-center gap-3">
                            <Label className="text-sm text-slate-600 whitespace-nowrap">{t("backupDay")}</Label>
                            <Select
                              value={String(backupSchedule.dayOfWeek)}
                              onValueChange={(value) => saveBackupSchedule({ ...backupSchedule, dayOfWeek: parseInt(value) })}
                            >
                              <SelectTrigger className="w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">{t("backupMonday")}</SelectItem>
                                <SelectItem value="2">{t("backupTuesday")}</SelectItem>
                                <SelectItem value="3">{t("backupWednesday")}</SelectItem>
                                <SelectItem value="4">{t("backupThursday")}</SelectItem>
                                <SelectItem value="5">{t("backupFriday")}</SelectItem>
                                <SelectItem value="6">{t("backupSaturday")}</SelectItem>
                                <SelectItem value="0">{t("backupSunday")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Day of month (for monthly) */}
                        {backupSchedule.frequency === 'monthly' && (
                          <div className="flex items-center gap-3">
                            <Label className="text-sm text-slate-600 whitespace-nowrap">{t("backupDayOfMonth")}</Label>
                            <Select
                              value={String(backupSchedule.dayOfMonth)}
                              onValueChange={(value) => saveBackupSchedule({ ...backupSchedule, dayOfMonth: parseInt(value) })}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[1, 5, 10, 15, 20, 25].map(d => (
                                  <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Time */}
                        <div className="flex items-center gap-3">
                          <Label className="text-sm text-slate-600 whitespace-nowrap">{t("backupTime")}</Label>
                          <input
                            type="time"
                            value={backupSchedule.hour}
                            onChange={(e) => saveBackupSchedule({ ...backupSchedule, hour: e.target.value })}
                            className="border rounded-md px-3 py-1.5 text-sm bg-white"
                          />
                        </div>
                      </>
                    )}

                    {/* Max backups (always visible) */}
                    <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
                      <Label className="text-sm text-slate-600 whitespace-nowrap">{t("maxBackups")}</Label>
                      <Select
                        value={String(backupSchedule.maxBackups)}
                        onValueChange={(value) => saveBackupSchedule({ ...backupSchedule, maxBackups: parseInt(value) })}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">3</SelectItem>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="0">{t("backupNoLimit")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-slate-500">{t("maxBackupsDesc")}</span>
                    </div>
                  </div>
                </div>

                {/* Liste des sauvegardes */}
                <div>
                  <h3 className="font-semibold text-slate-700 mb-4">{t("availableBackups")}</h3>
                  <div className="space-y-2">
                    {isLoadingBackups ? (
                      <div className="text-center py-8 text-slate-500">
                        <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
                        <p>{t("loadingBackups")}</p>
                      </div>
                    ) : backups.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <Database className="w-12 h-12 mx-auto mb-2" />
                        <p>{t("noBackups")}</p>
                      </div>
                    ) : (
                      backups.map((backup) => (
                        <div key={backup.fileName} className="border border-slate-200 rounded-lg p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <FileArchive className="w-5 h-5 text-slate-500" />
                            <div>
                              <p className="font-medium text-slate-800">{backup.fileName}</p>
                              <div className="flex items-center gap-4 text-sm text-slate-600">
                                <span>{backup.date}</span>
                                <span>{backup.size}</span>
                                <span className="text-blue-600">{backup.counts}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => downloadBackup(backup.fileName)}
                              variant="outline"
                              size="sm"
                              title={tCommon("download")}
                              className="hover:bg-secondary/20"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => {
                                setSelectedBackup(backup.fileName);
                                setRestoreModalOpen(true);
                              }}
                              variant="outline"
                              size="sm"
                              className="text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                              title={t("restore")}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => {
                                setDeleteBackupFileName(backup.fileName);
                                setIsDeleteBackupDialogOpen(true);
                              }}
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:bg-red-100 hover:text-red-700"
                              title={tCommon("delete")}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog de création de jour férié */}
        <Dialog open={isCreateHolidayDialogOpen} onOpenChange={setIsCreateHolidayDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("addHoliday")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>{t("holidayName")} *</Label>
                <Input
                  placeholder={t("holidayPlaceholder")}
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({...newHoliday, name: e.target.value})}
                />
              </div>
              
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday({...newHoliday, date: e.target.value})}
                />
              </div>

              <div>
                <Label>{t("cantonsAffected")} *</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {['CH', 'BE', 'ZH', 'VD'].map(canton => (
                    <label
                      key={canton}
                      className={`flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        newHoliday.cantons.includes(canton)
                          ? canton === 'CH' ? 'border-amber-500 bg-amber-50' : 'border-green-500 bg-green-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={newHoliday.cantons.includes(canton)}
                        onChange={() => toggleCanton(canton, true)}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium">
                        {canton}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label>{tCommon("type")}</Label>
                <Select 
                  value={newHoliday.type} 
                  onValueChange={(value: 'FEDERAL' | 'CANTONAL' | 'CUSTOM') => 
                    setNewHoliday({...newHoliday, type: value})
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FEDERAL">{t("federal")}</SelectItem>
                    <SelectItem value="CANTONAL">{t("cantonal")}</SelectItem>
                    <SelectItem value="CUSTOM">{t("custom")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t("optionalDescription")}</Label>
                <Textarea
                  placeholder={t("holidayDescriptionPlaceholder")}
                  value={newHoliday.description}
                  onChange={(e) => setNewHoliday({...newHoliday, description: e.target.value})}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button variant="outline" onClick={() => setIsCreateHolidayDialogOpen(false)} className="hover:bg-secondary/20">
                  {tCommon("cancel")}
                </Button>
                <Button
                  onClick={handleCreateHoliday}
                  className="bg-[#00ff7b] text-black hover:bg-secondary/20"
                >
                  {tCommon("create")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog d'édition de jour férié */}
        {selectedHoliday && (
          <Dialog open={isEditHolidayDialogOpen} onOpenChange={setIsEditHolidayDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("editHoliday")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>{t("holidayName")}</Label>
                  <Input
                    value={selectedHoliday.name}
                    onChange={(e) => setSelectedHoliday({...selectedHoliday, name: e.target.value})}
                  />
                </div>
                
                <div>
                  <Label>{tCommon("date")}</Label>
                  <Input
                    type="date"
                    value={selectedHoliday.date}
                    onChange={(e) => setSelectedHoliday({...selectedHoliday, date: e.target.value})}
                  />
                </div>

                <div>
                  <Label>{t("cantonsAffected")}</Label>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {['CH', 'BE', 'ZH', 'VD'].map(canton => (
                      <label
                        key={canton}
                        className={`flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                          selectedHoliday.cantons.includes(canton)
                            ? canton === 'CH' ? 'border-amber-500 bg-amber-50' : 'border-green-500 bg-green-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedHoliday.cantons.includes(canton)}
                          onChange={() => toggleCanton(canton, false)}
                          className="sr-only"
                        />
                        <span className="text-sm font-medium">
                          {canton}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>{tCommon("type")}</Label>
                  <Select 
                    value={selectedHoliday.type} 
                    onValueChange={(value) => setSelectedHoliday({...selectedHoliday, type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FEDERAL">{t("federal")}</SelectItem>
                      <SelectItem value="CANTONAL">{t("cantonal")}</SelectItem>
                      <SelectItem value="CUSTOM">{t("custom")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>{tCommon("description")}</Label>
                  <Textarea
                    value={selectedHoliday.description || ''}
                    onChange={(e) => setSelectedHoliday({...selectedHoliday, description: e.target.value})}
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button variant="outline" onClick={() => setIsEditHolidayDialogOpen(false)} className="hover:bg-secondary/20">
                    {tCommon("cancel")}
                  </Button>
                  <Button
                    onClick={handleEditHoliday}
                    className="bg-[#00ff7b] text-black hover:bg-secondary/20"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {tCommon("save")}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Modal de confirmation de restauration */}
        <Dialog open={restoreModalOpen} onOpenChange={setRestoreModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                {t("restoreBackup")}
              </DialogTitle>
              <DialogDescription>
                <strong className="text-red-600">
                  {t("restoreWarning")}
                </strong>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRestoreModalOpen(false)} className="hover:bg-secondary/20">
                {tCommon("cancel")}
              </Button>
              <Button
                onClick={restoreBackup}
                disabled={isRestoring}
                className="bg-red-600 hover:bg-red-700"
              >
                {isRestoring ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("restoring")}</>
                ) : (
                  <><RefreshCw className="w-4 h-4 mr-2" /> {t("restore")}</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de confirmation de suppression de sauvegarde */}
        <Dialog open={isDeleteBackupDialogOpen} onOpenChange={setIsDeleteBackupDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                {tCommon("confirm")} {tCommon("delete")}
              </DialogTitle>
              <DialogDescription>
                {t("deleteBackupConfirm")} <strong>{deleteBackupFileName}</strong> ?
                <strong className="block mt-2 text-red-600">
                  {t("actionIrreversible")}
                </strong>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteBackupDialogOpen(false)} className="hover:bg-secondary/20">
                {tCommon("cancel")}
              </Button>
              <Button
                onClick={deleteBackup}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {tCommon("delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de confirmation de suppression de jour férié */}
        <Dialog open={isDeleteHolidayDialogOpen} onOpenChange={setIsDeleteHolidayDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                {tCommon("confirm")} {tCommon("delete")}
              </DialogTitle>
              <DialogDescription>
                {t("deleteHolidayConfirm")}
                <strong className="block mt-2 text-red-600">
                  {t("actionIrreversible")}
                </strong>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteHolidayDialogOpen(false)} className="hover:bg-secondary/20">
                {tCommon("cancel")}
              </Button>
              <Button
                onClick={handleDeleteHoliday}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash className="w-4 h-4 mr-2" />
                {tCommon("delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete All Holidays Dialog */}
        <Dialog open={isDeleteAllHolidaysDialogOpen} onOpenChange={setIsDeleteAllHolidaysDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                {t("deleteAllHolidays") || "Delete all holidays"}
              </DialogTitle>
              <DialogDescription>
                {(t("deleteAllHolidaysConfirm") || "This will delete all {count} holidays for {year}.").replace('{count}', filteredHolidays.length.toString()).replace('{year}', selectedYear.toString())}
                <strong className="block mt-2 text-red-600">
                  {t("actionIrreversible")}
                </strong>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteAllHolidaysDialogOpen(false)} className="hover:bg-secondary/20">
                {tCommon("cancel")}
              </Button>
              <Button
                onClick={handleDeleteAllHolidays}
                disabled={isDeletingAllHolidays}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeletingAllHolidays ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                {t("deleteAll") || "Delete all"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default function SettingsPageProtected() {
  return <ProtectedRoute><SettingsPage /></ProtectedRoute>;
}