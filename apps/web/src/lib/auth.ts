import { create } from 'zustand';
import type { AuthResponse, MeResponse, MembershipView, UserView } from '@smtp/shared';
import { api, setAccessToken, setRefreshToken } from './api';

interface AuthState {
  user: UserView | null;
  memberships: MembershipView[];
  activeOrgId: string | null;
  loading: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  signup: (input: {
    email: string;
    password: string;
    name: string;
    orgName: string;
  }) => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  setActiveOrg: (orgId: string) => void;
}

const ACTIVE_ORG_KEY = 'smtp.active_org';

function acceptSession(res: AuthResponse) {
  setAccessToken(res.accessToken);
  setRefreshToken(res.refreshToken);
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  memberships: [],
  activeOrgId: localStorage.getItem(ACTIVE_ORG_KEY),
  loading: true,
  hydrated: false,

  hydrate: async () => {
    try {
      const me = await api<MeResponse>('/me');
      const activeOrgId =
        get().activeOrgId && me.memberships.some((m) => m.orgId === get().activeOrgId)
          ? get().activeOrgId
          : me.memberships[0]?.orgId ?? null;
      set({
        user: { id: me.id, email: me.email, name: me.name, emailVerified: me.emailVerified },
        memberships: me.memberships,
        activeOrgId,
        loading: false,
        hydrated: true,
      });
      if (activeOrgId) localStorage.setItem(ACTIVE_ORG_KEY, activeOrgId);
    } catch {
      set({ user: null, memberships: [], activeOrgId: null, loading: false, hydrated: true });
    }
  },

  signup: async (input) => {
    const res = await api<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    acceptSession(res);
    const activeOrgId = res.memberships[0]?.orgId ?? null;
    if (activeOrgId) localStorage.setItem(ACTIVE_ORG_KEY, activeOrgId);
    set({
      user: res.user,
      memberships: res.memberships,
      activeOrgId,
      hydrated: true,
      loading: false,
    });
  },

  login: async (input) => {
    const res = await api<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    acceptSession(res);
    const activeOrgId =
      (get().activeOrgId && res.memberships.some((m) => m.orgId === get().activeOrgId)
        ? get().activeOrgId
        : res.memberships[0]?.orgId) ?? null;
    if (activeOrgId) localStorage.setItem(ACTIVE_ORG_KEY, activeOrgId);
    set({
      user: res.user,
      memberships: res.memberships,
      activeOrgId,
      hydrated: true,
      loading: false,
    });
  },

  logout: async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // ignore — we're clearing local state either way
    }
    setAccessToken(null);
    setRefreshToken(null);
    localStorage.removeItem(ACTIVE_ORG_KEY);
    set({ user: null, memberships: [], activeOrgId: null });
  },

  setActiveOrg: (orgId) => {
    localStorage.setItem(ACTIVE_ORG_KEY, orgId);
    set({ activeOrgId: orgId });
  },
}));
