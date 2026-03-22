'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Loader2, Menu } from 'lucide-react';
import { Sidebar } from '@/components/ops/Sidebar';
import { ErrorBoundary } from '@/components/ops/ErrorBoundary';
import { useAuthStore } from '@/lib/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';

interface MeResponse {
  id: string;
  name: string;
  email: string;
  roleCode: string;
  roleName: string;
  permissions: string[];
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          permissions: me.permissions ?? [],
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
        {/* Desktop sidebar */}
        <div className="hidden lg:flex w-[240px] shrink-0">
          <Sidebar />
        </div>

        {/* Mobile sidebar drawer */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-[280px] p-0" showCloseButton={false}>
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile header */}
          <header className="flex lg:hidden items-center gap-3 h-14 px-4 border-b bg-card shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="flex items-center justify-center size-9 rounded-md hover:bg-muted transition-colors"
            >
              <Menu className="size-5" />
            </button>
            <div className="flex items-center gap-2 flex-1">
              <Image src="/logo.png" alt="Konma Xperience" width={28} height={28} style={{ height: '1.75rem', width: 'auto' }} />
              <span className="text-sm font-semibold tracking-tight">Konma Xperience</span>
            </div>
            <AnimatedThemeToggler />
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="p-6 max-w-[1200px] mx-auto w-full">{children}</div>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
