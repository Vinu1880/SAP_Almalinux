// lib/json-helpers.ts
// Helper functions for MSSQL compatibility
// MSSQL doesn't support native Json or array types, so these fields are stored as String.
// These helpers safely convert between JS objects/arrays and their stringified form.

/**
 * Safe JSON stringify - handles already-stringified values.
 * Use when WRITING to the database (create/update).
 */
export function toJsonString(val: any): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') return val;
  return JSON.stringify(val);
}

/**
 * Safe JSON parse - handles already-parsed values.
 * Use when READING from the database (GET).
 */
export function fromJsonString(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'string') return val;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}
