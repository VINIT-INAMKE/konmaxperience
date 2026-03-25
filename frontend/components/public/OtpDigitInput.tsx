'use client';

import { useRef, useCallback } from 'react';

interface OtpDigitInputProps {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}

export function OtpDigitInput({ value, onChange, disabled }: OtpDigitInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const focusInput = useCallback((index: number) => {
    inputsRef.current[index]?.focus();
  }, []);

  const handleChange = useCallback(
    (index: number, digit: string) => {
      if (!/^\d?$/.test(digit)) return;
      const chars = value.split('');
      while (chars.length < 6) chars.push('');
      chars[index] = digit;
      const newCode = chars.join('');
      onChange(newCode);
      if (digit && index < 5) {
        focusInput(index + 1);
      }
    },
    [value, onChange, focusInput],
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        const chars = value.split('');
        if (chars[index]) {
          chars[index] = '';
          onChange(chars.join(''));
        } else if (index > 0) {
          focusInput(index - 1);
        }
      } else if (e.key === 'ArrowLeft' && index > 0) {
        focusInput(index - 1);
      } else if (e.key === 'ArrowRight' && index < 5) {
        focusInput(index + 1);
      }
    },
    [value, onChange, focusInput],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      if (pasted.length === 6) {
        onChange(pasted);
        focusInput(5);
      }
    },
    [onChange, focusInput],
  );

  return (
    <div className="flex items-center justify-center gap-2" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          aria-label={`Digit ${i + 1} of 6`}
          disabled={disabled}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="size-11 text-center text-lg font-semibold border border-[var(--public-border)] rounded-lg bg-white focus:ring-2 focus:ring-[var(--public-accent)] focus:border-[var(--public-accent)] outline-none disabled:opacity-50"
        />
      ))}
    </div>
  );
}
