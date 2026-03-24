'use client';

import { useEffect, useRef } from 'react';
import { useMotionValue, useSpring } from 'motion/react';
import { cn } from '@/lib/utils';

interface AnimatedCostProps {
  value: number;
  prefix?: string;
  decimalPlaces?: number;
  className?: string;
}

export function AnimatedCost({
  value,
  prefix = '\u20B9',
  decimalPlaces = 2,
  className,
}: AnimatedCostProps) {
  const motionValue = useMotionValue(value);
  const springValue = useSpring(motionValue, { damping: 60, stiffness: 100 });
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  useEffect(() => {
    return springValue.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = `${prefix} ${latest.toFixed(decimalPlaces)}`;
      }
    });
  }, [springValue, prefix, decimalPlaces]);

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix} {value.toFixed(decimalPlaces)}
    </span>
  );
}
