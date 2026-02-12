// lib/validation.ts - Zod schemas for API input validation
import { z } from 'zod';

// Shared schemas
const cuidSchema = z.string().min(1).max(30);
const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const timeFormatSchema = z.string().regex(/^\d{2}:\d{2}$/);
const weekFormatSchema = z.string().regex(/^\d{4}-W\d{2}$/);
const dayOfWeekSchema = z.number().int().min(0).max(6);

// User
export const createUserSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(255),
  phone: z.string().max(30).nullable().optional(),
  location: z.string().max(10).nullable().optional(),
  role: z.string().max(100).nullable().optional(),
  workPercent: z.number().int().min(0).max(100).optional().default(100),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional().default('ACTIVE'),
  notes: z.string().max(1000).nullable().optional(),
  teamId: z.string().max(30).nullable().optional(),
  rotationConfig: z.object({
    patternId: z.string(),
    priority: z.string().optional().default('medium'),
    allowedShiftTypes: z.array(z.string()).optional().default([]),
  }).nullable().optional(),
  availability: z.any().nullable().optional(),
});
export const updateUserSchema = createUserSchema.partial();

// Team
export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  color: hexColorSchema.optional().default('#3b82f6'),
  leadId: z.string().max(30).nullable().optional(),
});
export const updateTeamSchema = createTeamSchema.partial().extend({
  memberIds: z.array(cuidSchema).optional(),
});

// Shift
export const createShiftSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  startTime: timeFormatSchema,
  endTime: timeFormatSchema,
  daysOfWeek: z.array(dayOfWeekSchema).optional().default([1, 2, 3, 4, 5]),
  membersRequired: z.number().int().min(1).max(100).optional().default(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional().default('ACTIVE'),
  color: hexColorSchema.optional().default('#3b82f6'),
  senderMailbox: z.string().max(255).optional().default(''),
  includedUserIds: z.array(cuidSchema).optional().default([]),
  excludedUserIds: z.array(cuidSchema).optional().default([]),
  teamId: cuidSchema,
});
export const updateShiftSchema = createShiftSchema.partial();

// Pikett
export const createPikettSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  startWeek: weekFormatSchema.or(z.literal('')),
  endWeek: weekFormatSchema.nullable().optional(),
  teamId: cuidSchema,
  color: hexColorSchema.optional().default('#dc2626'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional().default('ACTIVE'),
  is24_7: z.boolean().optional().default(true),
  includedUserIds: z.array(cuidSchema).optional().default([]),
  excludedUserIds: z.array(cuidSchema).optional().default([]),
  daysOfWeek: z.array(dayOfWeekSchema).optional().default([0, 1, 2, 3, 4, 5, 6]),
  userId: z.string().nullable().optional(),
});
export const updatePikettSchema = createPikettSchema.partial();

// Assignment (legacy)
export const createAssignmentsSchema = z.object({
  shiftId: cuidSchema,
  assignments: z.array(z.object({
    userId: cuidSchema,
    date: z.string(),
    status: z.enum(['PENDING', 'ACCEPTED', 'REFUSED', 'CANCELLED']).optional().default('PENDING'),
    reason: z.string().max(500).nullable().optional(),
  })).min(1).max(500),
});
export const updateAssignmentSchema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'REFUSED', 'CANCELLED']).optional(),
  reason: z.string().max(500).nullable().optional(),
  outlookEventId: z.string().max(255).nullable().optional(),
  respondedAt: z.string().nullable().optional(),
  resent: z.boolean().optional(),
  resentAt: z.string().nullable().optional(),
});

// Shift-Assignment bulk
export const createBulkShiftAssignmentsSchema = z.object({
  assignments: z.array(z.object({
    date: z.string(),
    shiftId: cuidSchema,
    userId: cuidSchema,
    status: z.enum(['PENDING', 'ACCEPTED', 'REFUSED', 'CANCELLED']).optional().default('PENDING'),
    reason: z.string().max(500).nullable().optional(),
    outlookEventId: z.string().max(255).nullable().optional(),
  })).min(1).max(1000),
});
export const checkConsecutiveSchema = z.object({
  userId: cuidSchema,
  date: z.string(),
});

// Rotation Pattern
export const createRotationPatternSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  cycleLength: z.number().int().min(1).max(52),
  weeks: z.any(),
  userShifts: z.any().optional(),
});
export const updateRotationPatternSchema = createRotationPatternSchema.partial();

// Holiday
export const createHolidaySchema = z.object({
  name: z.string().min(1).max(100),
  date: z.string(),
  cantons: z.array(z.string().max(5)).min(1),
  type: z.enum(['FEDERAL', 'CANTONAL', 'CUSTOM']),
  recurring: z.boolean().optional().default(false),
  description: z.string().max(500).nullable().optional(),
});
export const updateHolidaySchema = createHolidaySchema.partial();
export const importHolidaysSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  cantons: z.array(z.string().max(5)).min(1),
});

// Backup
export const restoreBackupSchema = z.object({
  fileName: z.string().max(200).optional(),
  confirmed: z.boolean().optional(),
  data: z.any().optional(),
});

// Helper function
export function validateBody<T>(schema: z.ZodType<T>, data: unknown): { success: boolean; data: T; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = (result.error as any).issues || (result.error as any).errors || [];
    const messages = issues.map((e: any) => `${(e.path || []).join('.')}: ${e.message}`).join(', ');
    return { success: false, data: undefined as any, error: `Validation failed: ${messages}` };
  }
  return { success: true, data: result.data, error: '' };
}
