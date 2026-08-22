'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="text-xl font-semibold">We could not find that page</h1>
        <p className="text-sm text-muted-foreground">
          It may have moved, or the link was mistyped.
        </p>
        <div className="flex gap-2">
          <Button nativeButton={false} render={<Link href="/" />}>
            Home
          </Button>
          <Button
            nativeButton={false}
            variant="outline"
            render={<Link href="/dashboard" />}
          >
            Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
