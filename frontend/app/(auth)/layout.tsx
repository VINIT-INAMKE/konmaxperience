'use client';

import { useRef, useCallback } from 'react';
import Image from 'next/image';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2; // -1 to 1
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    panel.style.setProperty('--mouse-x', `${x * 15}px`);
    panel.style.setProperty('--mouse-y', `${y * 10}px`);
  }, []);

  return (
    <div className="min-h-screen flex" style={{ colorScheme: 'light' }}>
      {/*
        Left brand panel. `dark` scopes the semantic tokens to this permanently
        near-black surface so --gold / --status-* resolve to their on-dark values
        whatever theme the rest of the app is in.
      */}
      <div
        ref={panelRef}
        onMouseMove={handleMouseMove}
        className="dark hidden lg:flex lg:w-[45%] bg-[var(--public-fg)] relative overflow-hidden flex-col justify-between p-12"
      >
        {/* Warm gradient orbs — mouse-reactive */}
        <div
          className="orb-drift absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-bl from-[var(--gold)]/10 to-transparent rounded-full blur-3xl pointer-events-none"
          style={{
            animation: 'orb-drift-1 25s ease-in-out infinite',
            transform: 'translate(var(--mouse-x, 0px), var(--mouse-y, 0px))',
            transition: 'transform 0.8s cubic-bezier(0.25, 0.1, 0.25, 1)',
          }}
        />
        <div
          className="orb-drift absolute bottom-0 left-0 w-[300px] h-[300px] bg-gradient-to-tr from-[var(--accent)]/5 to-transparent rounded-full blur-3xl pointer-events-none"
          style={{
            animation: 'orb-drift-2 30s ease-in-out infinite',
            transform: 'translate(calc(var(--mouse-x, 0px) * -0.7), calc(var(--mouse-y, 0px) * -0.7))',
            transition: 'transform 1s cubic-bezier(0.25, 0.1, 0.25, 1)',
          }}
        />

        {/* Dot pattern — drifting */}
        <div
          className="dot-drift absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--gold) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            animation: 'dot-drift 60s linear infinite',
          }}
        />

        {/* Brand mark */}
        <div className="relative z-10 flex items-center gap-3">
          <Image src="/logo.png" alt="Konma Xperience" width={48} height={48} style={{ height: '3rem', width: 'auto' }} />
          <span className="text-sm font-bold text-[var(--public-muted-stone)] tracking-tight">
            Konma Xperience
          </span>
        </div>

        {/* Brand statement */}
        <div className="relative z-10 space-y-6">
          <h1 className="text-5xl xl:text-6xl font-bold text-[var(--public-bg)] leading-[1.1] tracking-tight">
            Where food
            <br />
            meets{' '}
            <span className="relative inline-block">
              <span className="italic font-normal text-[var(--gold)]">mission</span>
              <span className="absolute -bottom-1 left-0 w-full h-2.5 bg-[var(--gold)]/20 -z-10 rounded-sm" />
            </span>
            <span className="italic font-normal text-[var(--gold)]">.</span>
          </h1>
          <p className="text-base text-[var(--public-muted)] max-w-sm leading-relaxed">
            A villa ecosystem where every meal, every event, and every team member
            is part of something bigger.
          </p>
        </div>

        {/* Status — enhanced glow pulse */}
        <div className="relative z-10 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div
              className="glow-pulse-dot size-1.5 rounded-full bg-[var(--status-good)] text-[var(--status-good)] motion-reduce:animate-none"
              style={{ animation: 'glow-pulse 2.5s ease-in-out infinite' }}
            />
            <span className="text-xs text-[var(--public-muted)] font-medium">Systems online</span>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col bg-[var(--public-bg)]">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-2.5 p-6">
          <Image src="/logo.png" alt="Konma Xperience" width={36} height={36} style={{ height: '2.25rem', width: 'auto' }} />
          <span className="text-sm font-bold text-[var(--public-fg)] tracking-tight">Konma Xperience</span>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-6 pb-12 lg:pb-0">
          {children}
        </div>
      </div>
    </div>
  );
}
