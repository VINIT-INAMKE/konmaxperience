'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { User } from 'lucide-react';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    // Quick client-side check for customer cookie presence
    setHasSession(document.cookie.includes('customer_access_token'));
  }, []);

  return (
    <div className="light min-h-screen bg-background text-foreground flex flex-col">
      <header className="h-14 border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-10 flex items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="Konma Xperience" width={36} height={36} style={{ height: '2.25rem', width: 'auto' }} />
          <span className="text-sm font-bold tracking-tight">
            Konma Xperience
          </span>
        </Link>
        <Link
          href="/profile"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <User className="size-4" />
          <span>{hasSession ? 'Profile' : 'Log in'}</span>
        </Link>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="h-10 flex items-center justify-center border-t border-border/30">
        <span className="text-xs text-muted-foreground">
          Powered by Konma Xperience
        </span>
      </footer>
    </div>
  );
}
