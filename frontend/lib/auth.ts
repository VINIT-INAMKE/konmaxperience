import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { LoginResponse, RefreshResponse } from '@/lib/types/auth';

export async function login(
  email: string,
  password: string,
): Promise<string> {
  const data = await apiClient.post<LoginResponse>('/auth/login', {
    email,
    password,
  });
  useAuthStore.getState().setUser(data.user);
  useAuthStore.getState().setPermissions(data.user.permissions ?? []);
  return '/dashboard';
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } catch {
    // Even if the API call fails, clear local state
  }
  useAuthStore.getState().clearUser();
  window.location.href = '/team';
}

export async function logoutAll(): Promise<void> {
  try {
    await apiClient.post('/auth/logout-all');
  } catch {
    // Even if the API call fails, clear local state
  }
  useAuthStore.getState().clearUser();
  window.location.href = '/team';
}

export async function refreshSession(): Promise<boolean> {
  try {
    const data = await apiClient.post<RefreshResponse>('/auth/refresh');
    if (data.user) {
      useAuthStore.getState().setUser(data.user);
      useAuthStore.getState().setPermissions(data.user.permissions ?? []);
    }
    return true;
  } catch {
    return false;
  }
}

export async function forgotPassword(
  email: string,
): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>('/auth/forgot-password', {
    email,
  });
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>('/auth/reset-password', {
    token,
    password,
  });
}

export async function setPassword(
  token: string,
  password: string,
): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>('/auth/set-password', {
    token,
    password,
  });
}
