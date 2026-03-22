'use client';

import Image from 'next/image';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex" style={{ colorScheme: 'light' }}>
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-[#1c1917] relative overflow-hidden flex-col justify-between p-12">
        {/* Warm gradient accent */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-bl from-amber-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-gradient-to-tr from-orange-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        {/* Dot pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle, #fbbf24 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />

        {/* Brand mark */}
        <div className="relative z-10 flex items-center gap-3">
          <Image src="/logo.png" alt="Konma Xperience" width={48} height={48} style={{ height: '3rem', width: 'auto' }} />
          <span className="text-sm font-bold text-[#a8a29e] tracking-tight">
            Konma Xperience
          </span>
        </div>

        {/* Brand statement */}
        <div className="relative z-10 space-y-6">
          <h1 className="text-5xl xl:text-6xl font-bold text-[#faf8f5] leading-[1.1] tracking-tight">
            Where food
            <br />
            meets{' '}
            <span className="relative inline-block">
              <span className="italic font-normal text-amber-400">mission</span>
              <span className="absolute -bottom-1 left-0 w-full h-2.5 bg-amber-500/20 -z-10 rounded-sm" />
            </span>
            <span className="italic font-normal text-amber-400">.</span>
          </h1>
          <p className="text-base text-[#78716c] max-w-sm leading-relaxed">
            A villa ecosystem where every meal, every event, and every team member
            is part of something bigger.
          </p>
        </div>

        {/* Status */}
        <div className="relative z-10 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-[#78716c] font-medium">Systems online</span>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col bg-[#faf8f5]">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-2.5 p-6">
          <Image src="/logo.png" alt="Konma Xperience" width={36} height={36} style={{ height: '2.25rem', width: 'auto' }} />
          <span className="text-sm font-bold text-[#1c1917] tracking-tight">Konma Xperience</span>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-6 pb-12 lg:pb-0">
          {children}
        </div>
      </div>
    </div>
  );
}
