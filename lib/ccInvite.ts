/**
 * Shared helpers for copying people on an invitation.
 *
 * A copied person is an optional attendee: they receive the invite and see the
 * slot on their calendar, but they do not hold the shift. The subject carries
 * their name too ("MAS Support - Vinu with Luis") so every calendar shows who
 * is involved at a glance, not just the mailbox that was invited.
 */

export interface CcPerson {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  displayName?: string;
}

const fullName = (u: CcPerson) =>
  u.displayName || `${u.firstName} ${u.lastName}`.trim();

/**
 * "Bernardo L." / "Bernardo L. and Regev M." / "A, B and C"
 *
 * Last name plus first initial: first names alone collapse when a team shares
 * one (or on accounts built as "Shiftpilot USER1..5"), and two people can share
 * a last name, so both halves are needed to tell colleagues apart.
 */
export function joinNames(people: CcPerson[], andWord = 'and'): string {
  if (people.length === 0) return '';
  const names = people.map(shortName);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} ${andWord} ${names[names.length - 1]}`;
}

/** "Bernardo L." — falls back to whatever half exists. */
export function shortName(u: CcPerson): string {
  const last = (u.lastName || '').trim();
  const initial = (u.firstName || '').trim().charAt(0);
  if (last && initial) return `${last} ${initial.toUpperCase()}.`;
  return last || fullName(u);
}

/** Appends "with X" to a subject when someone is copied. */
export function subjectWithCc(base: string, cc: CcPerson[], withWord = 'with'): string {
  if (cc.length === 0) return base;
  return `${base} ${withWord} ${joinNames(cc)}`;
}

/** Graph attendee entries for the copied people, always optional. */
export function ccAttendees(cc: CcPerson[]) {
  return cc
    .filter(u => !!u.email)
    .map(u => ({
      emailAddress: { address: u.email as string, name: fullName(u) },
      type: 'optional' as const,
    }));
}

/** Resolve ids against a user list, keeping the given order. */
export function resolveCc<T extends CcPerson>(ids: string[] | undefined, users: T[]): T[] {
  if (!ids || ids.length === 0) return [];
  const byId = new Map(users.map(u => [u.id, u]));
  return ids.map(id => byId.get(id)).filter((u): u is T => !!u);
}
