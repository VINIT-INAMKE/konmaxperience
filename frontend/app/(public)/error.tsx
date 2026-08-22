'use client';

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reportError } from '@/lib/report-error';

export default function PublicError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    reportError(error, { boundary: 'public', digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <AlertCircle className="size-10 text-destructive" />
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">
            Your work elsewhere is safe. Try again, or go back to the menu.
          </p>
          {error.digest && (
            <p className="font-mono text-xs text-muted-foreground">
              Reference: {error.digest}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => unstable_retry()}>Try again</Button>
          <Button
            variant="outline"
            onClick={() => window.location.assign('/menu')}
          >
            Back to menu
          </Button>
        </div>
      </div>
    </div>
  );
}
