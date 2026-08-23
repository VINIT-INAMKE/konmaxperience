'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Confetti, type ConfettiRef } from '@/components/ui/confetti';

interface LevelUpCelebrationProps {
  newLevel: number;
  onComplete?: () => void;
}

export function LevelUpCelebration({ newLevel, onComplete }: LevelUpCelebrationProps) {
  const confettiRef = useRef<ConfettiRef>(null);

  useEffect(() => {
    // Fire confetti
    void confettiRef.current?.fire({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });

    // Fire toast
    toast.success(`Level up! You're now Level ${newLevel}.`);

    // Call onComplete after 3s
    const timer = setTimeout(() => {
      onComplete?.();
    }, 3000);

    return () => clearTimeout(timer);
  }, [newLevel, onComplete]);

  return (
    <>
      {/* Confetti canvas — full screen, behind everything interactive */}
      <Confetti
        ref={confettiRef}
        manualstart
        className="pointer-events-none fixed inset-0 z-50 size-full"
        aria-hidden="true"
      />

      {/* "Level Up!" overlay text */}
      <div
        className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
        aria-hidden="true"
      >
        <span className="rounded-full bg-brand px-6 py-2 text-[28px] font-semibold text-brand-ink shadow-lg animate-in zoom-in-95 fade-in-0 duration-300 motion-reduce:animate-none">
          Level Up!
        </span>
      </div>
    </>
  );
}
