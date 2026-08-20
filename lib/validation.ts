// Zod schemas for API input validation
import { z } from 'zod';

const cuidSchema = z.string().min(1).max(30);
const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const timeFormatSchema = z.string().regex(/^\d{2}:\d{2}$/);
const weekFormatSchema = z.string().regex(/^\d{4}-W\d{2}$/);
const dayOfWeekSchema = z.number().int().min(0).max(6);

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
    allowedShiftTypes: z.array(z.string()).optional().default([]),
  }).nullable().optional(),
  availability: z.any().nullable().optional(),
});
export const updateUserSchema = createUserSchema.partial();

export const weekParityConfigSchema = z.object({
  parity: z.enum(['odd', 'even']),
});
export const doubleShiftConfigSchema = z.object({
  triggerShiftId: cuidSchema,
  linkedShiftId: cuidSchema,
}).refine(data => data.triggerShiftId !== data.linkedShiftId, {
  message: 'Trigger and linked shift must be different',
});
export const maxLoadConfigSchema = z.object({
  shiftId: cuidSchema,
  maxPercentage: z.number().int().min(1).max(100),
});
export const createUserRuleSchema = z.object({
  type: z.enum(['WEEK_PARITY', 'DOUBLE_SHIFT', 'MAX_LOAD']),
  config: z.any(),
  enabled: z.boolean().optional().default(true),
});
export const updateUserRuleSchema = createUserRuleSchema.partial();

export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  color: hexColorSchema.optional().default('#3b82f6'),
  leadId: z.string().max(30).nullable().optional(),
});
export const updateTeamSchema = createTeamSchema.partial().extend({
  memberIds: z.array(cuidSchema).optional(),
});

export const createShiftSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  startTime: timeFormatSchema,
  endTime: timeFormatSchema,
  daysOfWeek: z.array(dayOfWeekSchema).optional().default([1, 2, 3, 4, 5]),
  membersRequired: z.number().int().min(1).max(100).optional().default(1),
  minConsecutiveDays: z.number().int().min(1).max(5).optional().default(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional().default('ACTIVE'),
  color: hexColorSchema.optional().default('#3b82f6'),
  senderMailbox: z.string().max(255).optional().default(''),
  includedUserIds: z.array(cuidSchema).optional().default([]),
  excludedUserIds: z.array(cuidSchema).optional().default([]),
  teamId: cuidSchema,
});
export const updateShiftSchema = createShiftSchema.partial();

export const createPikettSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  startWeek: weekFormatSchema.or(z.literal('')),
  endWeek: weekFormatSchema.nullable().optional(),
  teamId: cuidSchema,
  color: hexColorSchema.optional().default('#dc2626'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional().default('ACTIVE'),
  is24_7: z.boolean().optional().default(true),
  senderMailbox: z.string().max(255).optional().default(''),
  startHour: z.string().regex(/^\d{2}:\d{2}$/).optional().default('08:00'),
  minRestWeeks: z.number().int().min(0).max(12).optional().default(3),
  avoidSupportSameWeek: z.boolean().optional().default(true),
  includedUserIds: z.array(cuidSchema).optional().default([]),
  excludedUserIds: z.array(cuidSchema).optional().default([]),
  userId: z.string().nullable().optional(),
});
export const updatePikettSchema = createPikettSchema.partial();

export const updateAssignmentSchema = z.object({
  status: z.enum(['PENDING', 'TENTATIVE', 'ACCEPTED', 'REFUSED', 'CANCELLED']).optional(),
  reason: z.string().max(500).nullable().optional(),
  outlookEventId: z.string().max(255).nullable().optional(),
  respondedAt: z.string().nullable().optional(),
  resent: z.boolean().optional(),
  resentAt: z.string().nullable().optional(),
  resentFromId: z.string().max(255).nullable().optional(),
  ccUserIds: z.array(cuidSchema).max(10).optional(),
});

export const createBulkShiftAssignmentsSchema = z.object({
  assignments: z.array(z.object({
    date: z.string(),
    shiftId: cuidSchema,
    userId: cuidSchema,
    status: z.enum(['PENDING', 'TENTATIVE', 'ACCEPTED', 'REFUSED', 'CANCELLED']).optional().default('PENDING'),
    reason: z.string().max(500).nullable().optional(),
    outlookEventId: z.string().max(255).nullable().optional(),
    // Present when the row belongs to a split slot (e.g. resending one segment).
    segmentStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    segmentEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    segmentGroupId: z.string().max(64).nullable().optional(),
    segmentIndex: z.number().int().min(1).max(6).nullable().optional(),
    // Optional attendees on the invitation. Informational only.
    ccUserIds: z.array(cuidSchema).max(10).optional(),
  })).min(1).max(1000),
});

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, 'Expected HH:MM');
const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

// Split a slot into contiguous segments. Segments must be ordered, gap-free,
// at least 30 minutes each, and together cover exactly the original window.
export const splitShiftAssignmentSchema = z.object({
  date: z.string(),
  shiftId: cuidSchema,
  segments: z.array(z.object({
    start: timeSchema,
    end: timeSchema,
    userId: cuidSchema,
    // Optional attendees, copied per segment: a handover can involve different
    // observers before and after the cut.
    ccUserIds: z.array(cuidSchema).max(10).optional(),
  })).min(2).max(6),
}).superRefine((val, ctx) => {
  const segs = val.segments;
  for (let i = 0; i < segs.length; i++) {
    const s = toMinutes(segs[i].start);
    const e = toMinutes(segs[i].end);
    if (e <= s) {
      ctx.addIssue({ code: 'custom', path: ['segments', i], message: 'Segment ends before it starts' });
      return;
    }
    if (e - s < 30) {
      ctx.addIssue({ code: 'custom', path: ['segments', i], message: 'Segment shorter than 30 minutes' });
      return;
    }
    if (i > 0 && segs[i].start !== segs[i - 1].end) {
      ctx.addIssue({ code: 'custom', path: ['segments', i], message: 'Segments must be contiguous and ordered' });
      return;
    }
  }
});

// Hand selected days of a pikett week to another person. Capped at 31 days:
// a handover covers part of a week, never a whole season.
export const reassignPikettDaysSchema = z.object({
  pikettId: cuidSchema,
  newUserId: cuidSchema,
  dates: z.array(z.string()).min(1).max(31),
  ccUserIds: z.array(cuidSchema).max(10).optional(),
});

export const createBulkPikettAssignmentsSchema = z.object({
  assignments: z.array(z.object({
    date: z.string(),
    pikettId: cuidSchema,
    userId: cuidSchema,
    status: z.enum(['PENDING', 'TENTATIVE', 'ACCEPTED', 'REFUSED', 'CANCELLED']).optional().default('PENDING'),
    reason: z.string().max(500).nullable().optional(),
    outlookEventId: z.string().max(255).nullable().optional(),
    // Optional attendees on the invitation. Informational only.
    ccUserIds: z.array(cuidSchema).max(10).optional(),
  })).min(1).max(1000),
});
export const createRotationPatternSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  cycleLength: z.number().int().min(1).max(52),
  weeks: z.any(),
  userShifts: z.any().optional(),
});
export const updateRotationPatternSchema = createRotationPatternSchema.partial();

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

export function validateBody<T>(schema: z.ZodType<T>, data: unknown): { success: boolean; data: T; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = (result.error as any).issues || (result.error as any).errors || [];
    const messages = issues.map((e: any) => `${(e.path || []).join('.')}: ${e.message}`).join(', ');
    return { success: false, data: undefined as any, error: `Validation failed: ${messages}` };
  }
  return { success: true, data: result.data, error: '' };
}
