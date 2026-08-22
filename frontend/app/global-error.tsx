'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { reportError } from '@/lib/report-error';
import './globals.css';

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    reportError(error, { boundary: 'global', digest: error.digest });
  }, [error]);

  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="flex min-h-full items-center justify-center bg-background font-sans text-foreground">
        <div className="flex max-w-md flex-col items-center gap-4 px-6 text-center">
          <h1 className="text-xl font-semibold">
            Konma Xperience hit an unexpected error
          </h1>
          <p className="text-sm text-muted-foreground">
            Reload to continue. If it keeps happening, tell the tech lead and
            quote the reference below.
          </p>
          {error.digest && (
            <p className="font-mono text-xs text-muted-foreground">
              Reference: {error.digest}
            </p>
          )}
          <Button onClick={() => unstable_retry()}>Try again</Button>
        </div>
      </body>
    </html>
  );
}
