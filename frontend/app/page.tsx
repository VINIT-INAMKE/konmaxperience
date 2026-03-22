import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, UtensilsCrossed, CalendarDays, MessageSquare, Rocket, ChefHat, Gauge, Trophy } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ colorScheme: 'light' }}>
      {/* ── Navigation ── */}
      <nav className="sticky top-0 z-30 bg-[#faf8f5]/90 backdrop-blur border-b border-[#e8e0d4]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Konma Xperience" width={36} height={36} style={{ height: '2.25rem', width: 'auto' }} />
            <span className="text-sm font-bold text-[#1c1917] tracking-tight">Konma Xperience</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/menu" className="text-sm text-[#78716c] hover:text-[#1c1917] transition-colors hidden sm:block">
              Menu
            </Link>
            <Link href="/events" className="text-sm text-[#78716c] hover:text-[#1c1917] transition-colors hidden sm:block">
              Events
            </Link>
            <Link
              href="/login"
              className="text-sm font-semibold bg-[#1c1917] text-[#faf8f5] px-4 py-1.5 rounded-lg hover:bg-[#292524] transition-colors"
            >
              Team Login
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative bg-[#faf8f5] overflow-hidden">
        {/* Warm gradient orb */}
        <div className="absolute top-[-200px] right-[-100px] w-[700px] h-[700px] bg-gradient-to-br from-amber-300/20 via-orange-200/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-100px] left-[-200px] w-[500px] h-[500px] bg-gradient-to-tr from-amber-200/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-24 relative z-10">
          <div className="grid md:grid-cols-12 gap-8 md:gap-16 items-end">
            <div className="md:col-span-8 space-y-8">
              <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200/60 rounded-full px-4 py-1.5">
                <div className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs font-semibold text-amber-800">Now serving at the villa</span>
              </div>
              <h1 className="text-5xl sm:text-6xl lg:text-[5.25rem] font-bold leading-[1.05] tracking-tight text-[#1c1917]">
                Where food
                <br />
                meets{' '}
                <span className="relative inline-block">
                  <span className="italic font-normal text-[#a16207]">mission</span>
                  <span className="absolute -bottom-1 left-0 w-full h-3 bg-amber-300/40 -z-10 rounded-sm" />
                </span>
                <span className="italic font-normal text-[#a16207]">.</span>
              </h1>
              <p className="text-lg text-[#78716c] max-w-lg leading-relaxed">
                A villa ecosystem where every meal, every event, and every team member
                is part of something bigger. We cook with purpose, operate with clarity,
                and celebrate every win.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/menu"
                  className="inline-flex items-center gap-2 bg-[#1c1917] text-[#faf8f5] px-7 py-3.5 rounded-lg text-sm font-semibold hover:bg-[#292524] transition-colors"
                >
                  Browse our menu
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/events"
                  className="inline-flex items-center gap-2 border border-[#d6cfc4] text-[#1c1917] px-7 py-3.5 rounded-lg text-sm font-semibold hover:bg-[#f0ebe3] transition-colors"
                >
                  Upcoming events
                </Link>
              </div>
            </div>

            {/* Right — live card */}
            <div className="md:col-span-4 hidden md:block">
              <div className="rounded-2xl border border-[#e8e0d4] bg-white/80 backdrop-blur p-6 space-y-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a1977e]">Live now</p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ChefHat className="size-4 text-[#a1977e]" />
                      <span className="text-sm text-[#44403c]">Kitchen</span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">Active</span>
                  </div>
                  <div className="border-t border-[#f0ebe3]" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="size-4 text-[#a1977e]" />
                      <span className="text-sm text-[#44403c]">Events</span>
                    </div>
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full">Bookable</span>
                  </div>
                  <div className="border-t border-[#f0ebe3]" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Rocket className="size-4 text-[#a1977e]" />
                      <span className="text-sm text-[#44403c]">Team</span>
                    </div>
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">On mission</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Guest Hub ── */}
      <section className="bg-[#f0ebe3] border-y border-[#e0d8cc]">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="mb-14 max-w-md">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a1977e] mb-3">For Guests</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight text-[#1c1917]">
              Your table is ready.
            </h2>
            <p className="text-base text-[#78716c] mt-4 leading-relaxed">
              Browse what we are cooking, book a seat at our next experience,
              or tell us how your last meal was.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Menu tile — dominant, warm dark */}
            <Link
              href="/menu"
              className="group relative overflow-hidden rounded-2xl bg-[#1c1917] text-[#faf8f5] p-8 sm:p-10 flex flex-col justify-between min-h-[220px] lg:row-span-2 lg:min-h-[460px] hover:bg-[#292524] transition-colors"
            >
              <div>
                <UtensilsCrossed className="size-7 text-amber-400 mb-6" />
                <h3 className="text-2xl lg:text-3xl font-bold tracking-tight">Our Menu</h3>
                <p className="text-sm text-[#a8a29e] mt-3 max-w-xs leading-relaxed">
                  Live availability, multiple brands, categorized by what you are craving.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-400 mt-6 group-hover:gap-3 transition-all">
                Browse menu <ArrowRight className="size-4" />
              </span>
            </Link>

            {/* Events tile — terracotta accent */}
            <Link
              href="/events"
              className="group relative overflow-hidden rounded-2xl bg-[#c2410c] text-white p-8 flex flex-col justify-between min-h-[220px] hover:bg-[#b13a0a] transition-colors"
            >
              <div>
                <CalendarDays className="size-6 text-orange-200 mb-6" />
                <h3 className="text-xl font-bold tracking-tight">Upcoming Events</h3>
                <p className="text-sm text-orange-100/70 mt-2 leading-relaxed">
                  Tastings, pop-ups, and experiences you won&apos;t forget. Book your spot.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-200 mt-6 group-hover:gap-3 transition-all">
                See events <ArrowRight className="size-4" />
              </span>
            </Link>

            {/* Feedback tile — olive/sage */}
            <Link
              href="/feedback/demo"
              className="group relative overflow-hidden rounded-2xl bg-[#365314] text-white p-8 flex flex-col justify-between min-h-[220px] hover:bg-[#2d4510] transition-colors"
            >
              <div>
                <MessageSquare className="size-6 text-lime-300 mb-6" />
                <h3 className="text-xl font-bold tracking-tight">Share Feedback</h3>
                <p className="text-sm text-lime-100/60 mt-2 leading-relaxed">
                  Loved it? Tell us. Something off? We want to know. Takes 30 seconds.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-lime-300 mt-6 group-hover:gap-3 transition-all">
                Leave feedback <ArrowRight className="size-4" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Platform section — rich warm dark ── */}
      <section className="bg-[#1c1917] text-[#faf8f5]">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="grid md:grid-cols-12 gap-12 md:gap-16">
            <div className="md:col-span-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500/70 mb-3">For the Team</p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
                Not just a kitchen.
                <br />
                An operating system.
              </h2>
              <p className="text-base text-[#a8a29e] mt-6 leading-relaxed">
                Konma Xperience OS coordinates people, space, recipes, inventory,
                and ambition into one focused workflow. Every task earns XP.
                Every quest moves the mission forward.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 mt-8 bg-amber-500 text-[#1c1917] px-6 py-3 rounded-lg text-sm font-bold hover:bg-amber-400 transition-colors"
              >
                Team login <ArrowRight className="size-4" />
              </Link>
            </div>

            <div className="md:col-span-7 grid sm:grid-cols-2 gap-x-10 gap-y-10">
              <div className="space-y-3">
                <div className="size-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Rocket className="size-4 text-amber-500" />
                </div>
                <p className="text-sm font-bold tracking-wider">Missions & Quests</p>
                <p className="text-sm text-[#a8a29e] leading-relaxed">
                  Long-term goals break into weekly quests, quests into tasks.
                  Every completed task is evidence-backed and earns XP.
                </p>
              </div>
              <div className="space-y-3">
                <div className="size-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <ChefHat className="size-4 text-orange-400" />
                </div>
                <p className="text-sm font-bold tracking-wider">Real-time Kitchen</p>
                <p className="text-sm text-[#a8a29e] leading-relaxed">
                  Kitchen display, prep batch tracking, waste logging, and
                  inventory that updates as you cook.
                </p>
              </div>
              <div className="space-y-3">
                <div className="size-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Gauge className="size-4 text-emerald-400" />
                </div>
                <p className="text-sm font-bold tracking-wider">Readiness Intelligence</p>
                <p className="text-sm text-[#a8a29e] leading-relaxed">
                  Gauge how ready each area is. Surface what needs attention
                  before it becomes a problem.
                </p>
              </div>
              <div className="space-y-3">
                <div className="size-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Trophy className="size-4 text-purple-400" />
                </div>
                <p className="text-sm font-bold tracking-wider">Gamified Growth</p>
                <p className="text-sm text-[#a8a29e] leading-relaxed">
                  XP, levels, leaderboards, and celebrations. Real work turns
                  into visible progress.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#faf8f5] border-t border-[#e8e0d4]">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Konma Xperience" width={32} height={32} style={{ height: '2rem', width: 'auto' }} />
            <span className="text-xs text-[#a1977e]">Konma Xperience</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/menu" className="text-xs text-[#a1977e] hover:text-[#1c1917] transition-colors">Menu</Link>
            <Link href="/events" className="text-xs text-[#a1977e] hover:text-[#1c1917] transition-colors">Events</Link>
            <Link href="/login" className="text-xs text-[#a1977e] hover:text-[#1c1917] transition-colors">Team Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
