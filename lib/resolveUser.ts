import { prisma } from './prisma';
import type { AuthUser } from './auth';

/**
 * Map the signed-in Azure AD identity to a row in our User table.
 *
 * auth.user.id is the Azure object id, which has nothing to do with the cuid
 * used as User.id here. Writing it straight into a foreign key such as
 * sentById breaks the constraint, so the account is looked up by email
 * instead — the one value both sides share.
 *
 * Returns null when no local account matches, which is expected: an admin may
 * sign in without being part of the planned team. Callers store null rather
 * than failing, since "who sent this" is informational.
 */
export async function resolveLocalUserId(authUser: AuthUser): Promise<string | null> {
  const email = (authUser.mail || authUser.userPrincipalName || '').toLowerCase();
  if (!email) return null;

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  });

  return user?.id ?? null;
}
