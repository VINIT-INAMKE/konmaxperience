'use client';

import { useEffect, useReducer } from 'react';

interface KdsElapsedTimerProps {
  createdAt: string;
}

// Shared tick: all timer instances subscribe to a single interval
const tickListeners = new Set<() => void>();
let tickInterval: ReturnType<typeof setInterval> | null = null;

function subscribeTick(listener: () => void) {
  tickListeners.add(listener);
  if (!tickInterval) {
    tickInterval = setInterval(() => {
      tickListeners.forEach((fn) => fn());
    }, 1000);
  }
  return () => {
    tickListeners.delete(listener);
    if (tickListeners.size === 0 && tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  };
}

export function KdsElapsedTimer({ createdAt }: KdsElapsedTimerProps) {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => subscribeTick(forceUpdate), []);

  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
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

  // Color thresholds per UI-SPEC — the status ramp, not a hue of its own.
  let colorClass: string;
  if (minutes < 10) {
    colorClass = 'text-good';
  } else if (minutes < 20) {
    colorClass = 'text-warning';
  } else {
    colorClass = 'text-critical';
  }

  return (
    <span className={`text-2xl font-bold leading-none ${colorClass}`}>
      {display}
    </span>
  );
}
