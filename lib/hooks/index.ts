// lib/hooks/index.ts

export { useShifts } from './useShifts';
export { useUsers } from './useUsers';
export { useTeams } from './useTeams';
export { useAssignments } from './useAssignments';
export { useHolidays } from './useHolidays';

export type { Shift } from './useShifts';
export type { Assignment } from './useAssignments';
export type { Holiday } from './useHolidays';

// Types pour User et Team (à défaut d'exports depuis les hooks)
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  location?: string;
  teamId?: string;
  role?: string;
  workPercent?: number;
  status: string;
  availability?: any;
  rotationConfig?: any;
  team?: Team;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  color: string;
  leadId?: string;
  createdAt: Date;
  updatedAt: Date;
}