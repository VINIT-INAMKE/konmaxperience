'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { SpineNav } from '@/components/ops/nav/SpineNav';
import { AppHeader } from '@/components/ops/header/AppHeader';
import { ErrorBoundary } from '@/components/ops/ErrorBoundary';
import { UsageTracker } from '@/components/ops/UsageTracker';
import { useAuthStore } from '@/lib/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { Sheet, SheetContent } from '@/components/ui/sheet';

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

/**
 * The ops shell: navigation spine (SPEC §6.2) on the left, persistent mission
 * header (SPEC §6.1) across the top, page in the middle.
 *
 * The header is mounted **outside** any breakpoint condition — the old layout
 * had a `lg:hidden` mobile-only bar, which meant desktop users had no mission
 * context at all. Every ops page now carries the header at every width, and the
 * spine is a fixed rail from `lg` up and a sheet below it.
 */
export default function OpsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [ready, setReady] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // Lock body scroll — the ops shell scrolls <main>, not the document.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

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
        router.push('/team');
      }
    }
    void initUser();
  }, [user, setUser, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Loader2
          className="size-6 animate-spin text-ink-muted motion-reduce:animate-none"
          aria-label="Loading"
        />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <UsageTracker />
      <div className="flex h-screen overflow-hidden bg-bg">
        {/* Desktop rail */}
        <div className="hidden w-[248px] shrink-0 lg:flex">
          <SpineNav />
        </div>

        {/* Mobile drawer — the same spine, closing itself on navigate. */}
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetContent
            side="left"
            className="w-[288px] p-0"
            showCloseButton={false}
            aria-label="Navigation"
          >
            <SpineNav onNavigate={() => setNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader onOpenNav={() => setNavOpen(true)} />

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1200px] p-4 sm:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
