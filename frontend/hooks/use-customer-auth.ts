'use client';

import { useState, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import type { Customer, VerifyOtpResponse } from '@/lib/types/customer-auth';

export function useCustomerAuth() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef(false);

  const fetchProfile = useCallback(async () => {
    // Only attempt once per mount — avoid 401 spam when no cookie exists
    if (fetchedRef.current) return customer;
    fetchedRef.current = true;
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
  }, [customer]);

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
    fetchedRef.current = true; // mark as fetched so profile doesn't re-call
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
    fetchedRef.current = false; // allow one fetch attempt on next visit
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
