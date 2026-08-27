"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, AdminMe, AdminApiError } from '@/lib/adminApi';

interface AdminSessionContextValue {
  me: AdminMe | null;
  loading: boolean;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AdminSessionContext = createContext<AdminSessionContextValue | undefined>(undefined);

export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<AdminMe | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await adminApi.me();
      setMe(data);
    } catch (err) {
      setMe(null);
      if (err instanceof AdminApiError && err.status === 401) {
        router.replace('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch('/admin/api/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setMe(null);
    router.push('/admin/login');
  }, [router]);

  return (
    <AdminSessionContext.Provider value={{ me, loading, logout, refresh }}>
      {children}
    </AdminSessionContext.Provider>
  );
}

export function useAdminSession() {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) throw new Error('useAdminSession must be used within AdminSessionProvider');
  return ctx;
}
