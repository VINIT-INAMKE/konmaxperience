'use client';

import { useEffect, useState } from 'react';

interface KdsElapsedTimerProps {
  createdAt: string;
}

export function KdsElapsedTimer({ createdAt }: KdsElapsedTimerProps) {
  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [createdAt]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  let display: string;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    display = `${hours}h ${remainingMinutes}m`;
  } else {
    display = `${minutes}m ${seconds}s`;
  }

  // Color thresholds per UI-SPEC
  let colorClass: string;
  if (minutes < 10) {
    colorClass = 'text-[oklch(0.627_0.194_142.495)]'; // green
  } else if (minutes < 20) {
    colorClass = 'text-[oklch(0.769_0.188_70.08)]'; // amber
  } else {
    colorClass = 'text-destructive'; // red
  }

  return (
    <span className={`text-2xl font-bold leading-none ${colorClass}`}>
      {display}
    </span>
  );
}
