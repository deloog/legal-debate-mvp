import { prisma } from '@/lib/db/prisma';
import { UserRole } from '@/types/auth';

export const SYSTEM_ROLE_NAMES = [
  UserRole.USER,
  UserRole.LAWYER,
  UserRole.ENTERPRISE,
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
] as const;

export function isSystemRoleName(roleName: string): boolean {
  return SYSTEM_ROLE_NAMES.includes(
    roleName as (typeof SYSTEM_ROLE_NAMES)[number]
  );
}

export function isPrivilegedRoleName(
  roleName: string | null | undefined
): boolean {
  return roleName === UserRole.ADMIN || roleName === UserRole.SUPER_ADMIN;
}

export async function getFreshUserRole(
  userId: string
): Promise<UserRole | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  return (user?.role as UserRole | undefined) ?? null;
}

export function requiresSuperAdminForUserRoleChange(
  targetCurrentRole: string | null | undefined,
  targetNextRole: string | null | undefined
): boolean {
  return (
    isPrivilegedRoleName(targetCurrentRole) ||
    isPrivilegedRoleName(targetNextRole)
  );
}

export function canManagePrivilegedRole(
  actorRole: string | null | undefined
): boolean {
  return actorRole === UserRole.SUPER_ADMIN;
}
