'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { Customer, VerifyOtpResponse } from '@/lib/types/customer-auth';

export function useCustomerAuth() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const profile = await apiClient.get<Customer>('/customer-auth/profile');
      setCustomer(profile);
      return profile;
    } catch {
      setCustomer(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendOtp = useCallback(async (phone: string) => {
    return apiClient.post<{ message: string }>('/customer-auth/send-otp', {
      phone,
    });
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string) => {
    const result = await apiClient.post<VerifyOtpResponse>(
      '/customer-auth/verify-otp',
      { phone, otp },
    );
    setCustomer(result.customer);
    return result;
  }, []);

  const updateProfile = useCallback(
    async (data: { name?: string; email?: string }) => {
      const updated = await apiClient.patch<Customer>(
        '/customer-auth/profile',
        data,
      );
      setCustomer(updated);
      return updated;
    },
    [],
  );

  const logout = useCallback(async () => {
    await apiClient.post('/customer-auth/logout', {});
    setCustomer(null);
  }, []);

  return {
    customer,
    isLoading,
    fetchProfile,
    sendOtp,
    verifyOtp,
    updateProfile,
    logout,
  };
}
