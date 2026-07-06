import { useAuth } from './auth';

// Small helper so every page doesn't repeat the fallback logic.
export function useOrgId(): string | null {
  return useAuth((s) => s.activeOrgId);
}
