// SQL that Prisma's schema cannot express, applied at startup after db push.
// Every statement must be idempotent: this runs on every boot.

import { prisma } from './prisma';

const SLOT_INDEX = 'ShiftAssignment_slot_segment_key';
const PRISMA_INDEX = 'ShiftAssignment_date_shiftId_userId_segmentIndex_key';
const LEGACY_INDEX = 'ShiftAssignment_date_shiftId_userId_key';

/**
 * Uniqueness for shift slots, split-shift aware.
 *
 * A split lets one person hold several segments of the same slot, which the
 * original UNIQUE(date, shiftId, userId) forbids. Adding segmentIndex to the
 * key is not enough either: Postgres treats NULLs as distinct, so unsplit rows
 * (segmentIndex NULL) could then be duplicated freely. COALESCE(...,0) maps
 * them to a single value and restores the one-row-per-slot guarantee.
 *
 * Expression indexes are outside Prisma's schema language, so db push neither
 * creates this one nor drops it — hence applying it here.
 */
export async function ensureSlotSegmentIndex(): Promise<void> {
  const [{ exists }] = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'ShiftAssignment' AND indexname = ${SLOT_INDEX}
    ) AS "exists"
  `;
  if (exists) return;

  // Refuse rather than fail halfway: duplicates would make the CREATE throw,
  // and a half-applied migration is worse than a logged warning.
  const dupes = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*) AS n FROM (
      SELECT 1 FROM "ShiftAssignment"
      GROUP BY "date", "shiftId", "userId", COALESCE("segmentIndex", 0)
      HAVING COUNT(*) > 1
    ) d
  `;
  if (Number(dupes[0]?.n ?? 0) > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `[migrations] ${SLOT_INDEX} not created: ${dupes[0].n} duplicate slot(s) found. ` +
      'Resolve them, then restart to apply the constraint.'
    );
    return;
  }

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX "${SLOT_INDEX}" ON "ShiftAssignment"` +
    `("date", "shiftId", "userId", (COALESCE("segmentIndex", 0)))`
  );

  // Drop the narrower constraints only once the new one is in place.
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${PRISMA_INDEX}"`);
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${LEGACY_INDEX}"`);

  // eslint-disable-next-line no-console
  console.log(`[migrations] ${SLOT_INDEX} created`);
}

export async function runStartupMigrations(): Promise<void> {
  try {
    await ensureSlotSegmentIndex();
  } catch (err) {
    // Never block startup: the app still runs, only the extra guarantee is missing.
    // eslint-disable-next-line no-console
    console.error('[migrations] failed', err);
  }
}
