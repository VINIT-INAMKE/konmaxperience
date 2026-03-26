'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, UtensilsCrossed, CalendarDays, MessageSquare, Rocket, ChefHat, Gauge, Trophy } from 'lucide-react';
import { ScrollVideoStory } from '@/components/public/ScrollVideoStory';

const spring = { type: 'spring' as const, stiffness: 300, damping: 24 };
function getScrollHeightVH() {
  if (typeof window === 'undefined') return 450;
  if (window.innerWidth < 480) return 200;
  if (window.innerWidth < 640) return 250;
  return 450;
}

function ScrollReveal({
  children,
  delay = 0,
  className,
  direction = 'up',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  direction?: 'up' | 'left' | 'right';
}) {
  const reduced = useReducedMotion();
  const offsets = { up: { y: 40 }, left: { x: -40 }, right: { x: 40 } };
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, ...offsets[direction] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const [pastVideo, setPastVideo] = useState(false);

  useEffect(() => {
    // Switch nav style when scroll passes the video section
    const threshold = (getScrollHeightVH() / 100) * window.innerHeight * 0.85;
    function onScroll() {
      setPastVideo(window.scrollY > threshold);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen" style={{ colorScheme: 'light' }}>
      {/* ── Fixed Nav — adapts: white over video, dark over content ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${
          pastVideo
            ? 'bg-[#faf8f5e6] backdrop-blur border-b border-[var(--public-border)]'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Konma Xperience" width={32} height={32} style={{ height: '2rem', width: 'auto' }} />
            <span className={`text-sm font-bold tracking-tight transition-colors duration-500 hidden sm:inline ${pastVideo ? 'text-[var(--public-fg)]' : 'text-white drop-shadow-sm'}`}>
              Konma Xperience
            </span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-6">
            <Link
              href="/menu"
              className={`text-sm px-2 py-1.5 rounded-md transition-colors duration-500 ${
                pastVideo ? 'text-[var(--public-muted)] hover:text-[var(--public-fg)]' : 'text-white/70 hover:text-white drop-shadow-sm'
              }`}
            >
              Menu
            </Link>
            <Link
              href="/events"
              className={`text-sm px-2 py-1.5 rounded-md transition-colors duration-500 ${
                pastVideo ? 'text-[var(--public-muted)] hover:text-[var(--public-fg)]' : 'text-white/70 hover:text-white drop-shadow-sm'
              }`}
            >
              Events
            </Link>
            <Link
              href="/login"
              className={`text-sm font-semibold px-4 py-1.5 rounded-lg transition-all duration-500 ${
                pastVideo
                  ? 'bg-[var(--public-fg)] text-[var(--public-bg)] hover:bg-[var(--public-fg-hover)]'
                  : 'bg-white/15 text-white backdrop-blur-sm hover:bg-white/25 border border-white/10'
              }`}
            >
              Team Login
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Scroll-Driven Video Story (replaces hero) ── */}
      <ScrollVideoStory />

      {/* ── Guest Hub — flows directly after video ── */}
      <section className="bg-[var(--public-surface)] border-y border-[var(--public-border-warm)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 md:py-28">
          <ScrollReveal className="mb-10 sm:mb-14 max-w-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--public-muted-warm)] mb-3">For Guests</p>
            <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-tight leading-[1.15] text-[var(--public-fg)]">
              Your table is ready.
            </h2>
            <p className="text-base text-[var(--public-muted)] mt-4 leading-relaxed">
              Browse what we are cooking, book a seat at our next experience,
              or tell us how your last meal was.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <ScrollReveal delay={0} direction="up">
              <motion.div whileHover={{ scale: 1.015, y: -4 }} transition={spring}>
                <Link
                  href="/menu"
                  className="group relative overflow-hidden rounded-2xl bg-[var(--public-fg)] text-[var(--public-bg)] p-6 sm:p-8 lg:p-10 flex flex-col justify-between min-h-[200px] sm:min-h-[220px] lg:row-span-2 lg:min-h-[460px] hover:shadow-xl transition-shadow duration-300"
                >
                  <div>
                    <UtensilsCrossed className="size-7 text-amber-400 mb-6" />
                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight">Our Menu</h3>
                    <p className="text-sm text-white/60 mt-3 max-w-xs leading-relaxed">
                      Live availability, multiple brands, categorized by what you are craving.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-400 mt-6 group-hover:gap-3 transition-all duration-300">
                    Browse menu <ArrowRight className="size-4" />
                  </span>
                </Link>
              </motion.div>
            </ScrollReveal>

            <ScrollReveal delay={0.1} direction="up">
              <motion.div whileHover={{ scale: 1.02, y: -4 }} transition={spring}>
                <Link
                  href="/events"
                  className="group relative overflow-hidden rounded-2xl bg-[#c2410c] text-white p-6 sm:p-8 flex flex-col justify-between min-h-[180px] sm:min-h-[220px] hover:shadow-xl transition-shadow duration-300"
                >
                  <div>
                    <CalendarDays className="size-6 text-white/80 mb-5" />
                    <h3 className="text-xl font-bold tracking-tight">Upcoming Events</h3>
                    <p className="text-sm text-white/75 mt-2 leading-relaxed">
                      Tastings, pop-ups, and experiences you won&apos;t forget. Book your spot.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white mt-6 group-hover:gap-3 transition-all duration-300">
                    See events <ArrowRight className="size-4" />
                  </span>
                </Link>
              </motion.div>
            </ScrollReveal>

            <ScrollReveal delay={0.2} direction="up">
              <motion.div whileHover={{ scale: 1.02, y: -4 }} transition={spring}>
                <Link
                  href="/feedback/demo"
                  className="group relative overflow-hidden rounded-2xl bg-[#365314] text-white p-6 sm:p-8 flex flex-col justify-between min-h-[180px] sm:min-h-[220px] hover:shadow-xl transition-shadow duration-300"
                >
                  <div>
                    <MessageSquare className="size-6 text-white/80 mb-5" />
                    <h3 className="text-xl font-bold tracking-tight">Share Feedback</h3>
                    <p className="text-sm text-white/75 mt-2 leading-relaxed">
                      Loved it? Tell us. Something off? We want to know. Takes 30 seconds.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white mt-6 group-hover:gap-3 transition-all duration-300">
                    Leave feedback <ArrowRight className="size-4" />
                  </span>
                </Link>
              </motion.div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Platform section ── */}
      <section className="bg-[var(--public-fg)] text-[var(--public-bg)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 md:py-28">
          <div className="grid md:grid-cols-12 gap-10 md:gap-16">
            <ScrollReveal direction="left" className="md:col-span-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-amber-500/70 mb-3">For the Team</p>
              <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-tight leading-[1.15]">
                Not just a kitchen.
                <br />
                An operating system.
              </h2>
              <p className="text-base text-white/60 mt-6 leading-relaxed">
                Konma Xperience OS coordinates people, space, recipes, inventory,
                and ambition into one focused workflow. Every task earns XP.
                Every quest moves the mission forward.
              </p>
              <Link
                href="/team"
                className="inline-flex items-center gap-2 mt-8 bg-amber-500 text-[var(--public-fg)] px-6 py-3 rounded-lg text-sm font-bold hover:bg-amber-400 transition-colors"
              >
                Team login <ArrowRight className="size-4" />
              </Link>
            </ScrollReveal>

            <div className="md:col-span-7 grid grid-cols-2 gap-x-5 gap-y-6 sm:gap-x-10 sm:gap-y-10">
              <ScrollReveal delay={0} direction="right">
                <div className="space-y-3">
                  <div className="size-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Rocket className="size-4 text-amber-500" />
                  </div>
                  <p className="text-sm font-bold tracking-wide">Missions & Quests</p>
                  <p className="text-xs sm:text-[13px] text-white/60 leading-relaxed">
                    Long-term goals break into weekly quests, quests into tasks.
                    Every completed task is evidence-backed and earns XP.
                  </p>
                </div>
              </ScrollReveal>
              <ScrollReveal delay={0.1} direction="right">
                <div className="space-y-3">
                  <div className="size-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <ChefHat className="size-4 text-orange-400" />
                  </div>
                  <p className="text-sm font-bold tracking-wide">Real-time Kitchen</p>
                  <p className="text-xs sm:text-[13px] text-white/60 leading-relaxed">
                    Kitchen display, prep batch tracking, waste logging, and
                    inventory that updates as you cook.
                  </p>
                </div>
              </ScrollReveal>
              <ScrollReveal delay={0.2} direction="right">
                <div className="space-y-3">
                  <div className="size-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Gauge className="size-4 text-emerald-400" />
                  </div>
                  <p className="text-sm font-bold tracking-wide">Readiness Intelligence</p>
                  <p className="text-xs sm:text-[13px] text-white/60 leading-relaxed">
                    Gauge how ready each area is. Surface what needs attention
                    before it becomes a problem.
                  </p>
                </div>
              </ScrollReveal>
              <ScrollReveal delay={0.3} direction="right">
                <div className="space-y-3">
                  <div className="size-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Trophy className="size-4 text-purple-400" />
                  </div>
                  <p className="text-sm font-bold tracking-wide">Gamified Growth</p>
                  <p className="text-xs sm:text-[13px] text-white/60 leading-relaxed">
                    XP, levels, leaderboards, and celebrations. Real work turns
                    into visible progress.
                  </p>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[var(--public-bg)] border-t border-[var(--public-border)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Konma Xperience" width={32} height={32} style={{ height: '2rem', width: 'auto' }} />
            <span className="text-xs text-[var(--public-muted-warm)]">Konma Xperience</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/menu" className="text-xs text-[var(--public-muted-warm)] hover:text-[var(--public-fg)] transition-colors">Menu</Link>
            <Link href="/events" className="text-xs text-[var(--public-muted-warm)] hover:text-[var(--public-fg)] transition-colors">Events</Link>
            <Link href="/team" className="text-xs text-[var(--public-muted-warm)] hover:text-[var(--public-fg)] transition-colors">Team Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
