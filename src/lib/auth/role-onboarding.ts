import { UserRole } from '@/types/auth';
import type { UserRole as PrismaUserRole } from '@prisma/client';

type OnboardingRole = UserRole.LAWYER | UserRole.ENTERPRISE;
type EffectiveUserRole = PrismaUserRole;

const ADMIN_ROLES = new Set<string>([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
const WORKSPACE_ROLES = new Set<string>([UserRole.LAWYER, UserRole.ENTERPRISE]);

interface PreferencesWithOnboarding {
  onboarding?: {
    intendedRole?: unknown;
  };
}

export function normalizeOnboardingRole(role: unknown): OnboardingRole | null {
  return role === UserRole.LAWYER || role === UserRole.ENTERPRISE ? role : null;
}

export function getIntendedRoleFromPreferences(
  preferences: unknown
): OnboardingRole | null {
  if (!preferences || typeof preferences !== 'object') {
    return null;
  }

  const { onboarding } = preferences as PreferencesWithOnboarding;
  return normalizeOnboardingRole(onboarding?.intendedRole);
}

export function getEffectiveUserRole(
  role: string,
  preferences: unknown
): EffectiveUserRole {
  const intendedRole = getIntendedRoleFromPreferences(preferences);
  return (
    role === UserRole.USER && intendedRole ? intendedRole : role
  ) as EffectiveUserRole;
}

export function isAdminRole(role: string | null | undefined): boolean {
  return !!role && ADMIN_ROLES.has(role);
}

export function isWorkspaceRole(role: string | null | undefined): boolean {
  return !!role && WORKSPACE_ROLES.has(role);
}

export function getDefaultAuthDestination(
  role: string | null | undefined
): string {
  if (isAdminRole(role)) return '/admin';
  if (isWorkspaceRole(role)) return '/chat';
  if (role === UserRole.USER) return '/qualifications';
  return '/';
}
