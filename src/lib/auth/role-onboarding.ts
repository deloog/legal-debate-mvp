type OnboardingRole = 'LAWYER' | 'ENTERPRISE';

interface PreferencesWithOnboarding {
  onboarding?: {
    intendedRole?: unknown;
  };
}

export function normalizeOnboardingRole(role: unknown): OnboardingRole | null {
  return role === 'LAWYER' || role === 'ENTERPRISE' ? role : null;
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
