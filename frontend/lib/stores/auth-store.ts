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
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  permissions: string[];
  setUser: (user: LoginResponse['user']) => void;
  setPermissions: (permissions: string[]) => void;
  clearUser: () => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      permissions: [],
      setUser: (user) =>
        set({
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            roleCode: user.roleCode,
            roleName: user.roleName,
          },
          isAuthenticated: true,
        }),
      setPermissions: (permissions) => set({ permissions }),
      clearUser: () =>
        set({ user: null, isAuthenticated: false, permissions: [] }),
      hasPermission: (permission) => {
        const state = get();
        return state.permissions.includes(permission);
      },
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
