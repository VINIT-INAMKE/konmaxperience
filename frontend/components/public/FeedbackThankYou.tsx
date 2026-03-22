'use client';

import { useEffect, useRef } from 'react';
import { BlurFade } from '@/components/ui/blur-fade';
import { Confetti, type ConfettiRef } from '@/components/ui/confetti';

export function FeedbackThankYou() {
  const confettiRef = useRef<ConfettiRef>(null);

  useEffect(() => {
    confettiRef.current?.fire();
  }, []);

  return (
    <BlurFade direction="up">
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <h2 className="text-3xl font-semibold">Thank you!</h2>
        <p className="text-base text-gray-500">
          Your feedback helps us improve every meal.
        </p>
        <Confetti
          ref={confettiRef}
          manualstart
          className="pointer-events-none fixed inset-0 z-50 size-full"
        />
      </div>
    </BlurFade>
  );
}
