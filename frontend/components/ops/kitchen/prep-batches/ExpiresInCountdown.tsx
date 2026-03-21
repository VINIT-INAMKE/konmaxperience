'use client';

import { useState, useEffect } from 'react';

interface ExpiresInCountdownProps {
  expiresAt: string | null;
}

function getTimeRemaining(expiresAt: string): { hours: number; minutes: number; expired: boolean } {
  const now = Date.now();
  const expiry = new Date(expiresAt).getTime();
  const diff = expiry - now;

  if (diff <= 0) {
    return { hours: 0, minutes: 0, expired: true };
  }

  const totalMinutes = Math.floor(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return { hours, minutes, expired: false };
}

function getColorClass(hours: number, minutes: number): string {
  const totalMinutes = hours * 60 + minutes;

  if (totalMinutes < 60) {
    return 'text-destructive';
  }
  if (totalMinutes < 240) {
    return 'text-amber-600 dark:text-amber-400';
  }
  return '';
}

export function ExpiresInCountdown({ expiresAt }: ExpiresInCountdownProps) {
  const [time, setTime] = useState(() =>
    expiresAt ? getTimeRemaining(expiresAt) : null,
  );

  useEffect(() => {
    if (!expiresAt) return;

    setTime(getTimeRemaining(expiresAt));

    const interval = setInterval(() => {
      setTime(getTimeRemaining(expiresAt));
    }, 60000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt) {
    return <span className="text-muted-foreground text-sm">No expiry</span>;
  }

  if (!time || time.expired) {
    return null;
  }

  const colorClass = getColorClass(time.hours, time.minutes);

  return (
    <span className={`text-sm font-medium tabular-nums ${colorClass}`}>
      {time.hours}h {time.minutes}m
    </span>
  );
}
