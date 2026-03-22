'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LoginResponse } from '@/lib/types/auth';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roleCode: string;
  roleName: string;
  xp_total: number;
  level: number;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  permissions: string[];
  levelUpEvent: number | null;
  setUser: (user: LoginResponse['user']) => void;
  setPermissions: (permissions: string[]) => void;
  clearUser: () => void;
  hasPermission: (permission: string) => boolean;
  updateXpAndLevel: (xp_total: number, level: number) => void;
  triggerLevelUp: (level: number) => void;
  clearLevelUpEvent: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      permissions: [],
      levelUpEvent: null,
      setUser: (user) =>
        set({
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            roleCode: user.roleCode,
            roleName: user.roleName,
            xp_total: user.xp_total ?? 0,
            level: user.level ?? 1,
          },
          permissions: 'permissions' in user ? (user.permissions as string[]) : [],
          isAuthenticated: true,
        }),
      setPermissions: (permissions) => set({ permissions }),
      clearUser: () =>
        set({ user: null, isAuthenticated: false, permissions: [] }),
      hasPermission: (permission) => {
        const state = get();
        return state.permissions.includes(permission);
      },
      updateXpAndLevel: (xp_total, level) =>
        set((state) => ({
          user: state.user ? { ...state.user, xp_total, level } : null,
        })),
      triggerLevelUp: (level) => set({ levelUpEvent: level }),
      clearLevelUpEvent: () => set({ levelUpEvent: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? sessionStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
      ),
    },
  ),
);
