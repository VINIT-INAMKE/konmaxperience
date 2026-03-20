'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/ops/Sidebar';
import { ErrorBoundary } from '@/components/ops/ErrorBoundary';
import { useAuthStore } from '@/lib/stores/auth-store';
import { apiClient } from '@/lib/api-client';

interface MeResponse {
  id: string;
  name: string;
  email: string;
  roleCode: string;
  roleName: string;
  status: string;
  xpTotal: number;
  level: number;
  createdAt: string;
}

export default function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function initUser() {
      if (user) {
        setReady(true);
        return;
      }
      try {
        const me = await apiClient.get<MeResponse>('/auth/me');
        setUser({
          id: me.id,
          name: me.name,
          email: me.email,
          roleCode: me.roleCode,
          roleName: me.roleName,
          xp_total: me.xpTotal ?? 0,
          level: me.level ?? 1,
        });
        setReady(true);
      } catch {
        router.push('/login');
      }
    }
    void initUser();
  }, [user, setUser, router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin motion-reduce:animate-none text-muted-foreground" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-[1200px] mx-auto w-full">{children}</div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
