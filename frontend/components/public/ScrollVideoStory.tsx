'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Lenis from 'lenis';

const TOTAL_FRAMES = 576;
const FRAME_PATH = '/scroll-frames/f';

function getScrollHeight() {
  if (typeof window === 'undefined') return 450;
  return window.innerWidth < 640 ? 300 : 450;
}

// ── Beat definitions ──
interface Beat {
  enterStart: number;
  enterEnd: number;
  exitStart: number;
  exitEnd: number;
  zoom: number;
  panX: number;
  panY: number;
  // Color mood overlay
  tint: string;
}

const BEATS: Beat[] = [
  { enterStart: -1,   enterEnd: -1,    exitStart: 0.16, exitEnd: 0.22, zoom: 1.0,  panX: 0,     panY: 0,     tint: 'rgba(160,100,30,0.07)' },
  { enterStart: 0.28, enterEnd: 0.33,  exitStart: 0.44, exitEnd: 0.49, zoom: 1.12, panX: -0.08, panY: -0.04, tint: 'rgba(0,0,0,0)' },
  { enterStart: 0.53, enterEnd: 0.58,  exitStart: 0.69, exitEnd: 0.74, zoom: 1.08, panX: 0.06,  panY: 0.03,  tint: 'rgba(140,90,30,0.05)' },
  { enterStart: 0.78, enterEnd: 0.83,  exitStart: 0.90, exitEnd: 0.95, zoom: 1.15, panX: 0,     panY: -0.06, tint: 'rgba(0,0,0,0.08)' },
];

// ── Word data for split text reveals ──
const BEAT_WORDS: string[][] = [
  ['Where', 'food', 'meets', 'mission.'],
  ['Nothing', 'is', 'accidental.'],
  ['Every', 'plate.', 'Every', 'person.', 'Every', 'win.'],
  ['This', 'is', 'Konma.'],
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/** Per-beat text state — continuous */
function getBeatProgress(progress: number, beat: Beat) {
  if (progress < beat.enterStart) return 0;
  if (progress < beat.enterEnd) {
    return (progress - beat.enterStart) / (beat.enterEnd - beat.enterStart);
  }
  if (progress < beat.exitStart) return 1;
  if (progress < beat.exitEnd) {
    return 1 - (progress - beat.exitStart) / (beat.exitEnd - beat.exitStart);
  }
  return 0;
}

/** Get enter progress (0-1) for word-level stagger */
function getEnterProgress(progress: number, beat: Beat) {
  if (progress < beat.enterStart) return 0;
  if (progress >= beat.enterEnd) return 1;
  return (progress - beat.enterStart) / (beat.enterEnd - beat.enterStart);
}

/** Camera interpolation */
function getCameraState(progress: number) {
  let zoom = 1, panX = 0, panY = 0, tint = 'rgba(0,0,0,0)';

  for (let i = 0; i < BEATS.length; i++) {
    const center = (BEATS[i].enterEnd + BEATS[i].exitStart) / 2;
    const nextCenter = i < BEATS.length - 1 ? (BEATS[i + 1].enterEnd + BEATS[i + 1].exitStart) / 2 : 1;
    const prevCenter = i > 0 ? (BEATS[i - 1].enterEnd + BEATS[i - 1].exitStart) / 2 : 0;

    if (progress <= center && (i === 0 || progress > prevCenter)) {
      const from = i > 0 ? BEATS[i - 1] : { zoom: 1, panX: 0, panY: 0, tint: 'rgba(0,0,0,0)' };
      const t = i > 0 ? (progress - prevCenter) / (center - prevCenter) : progress / center;
      zoom = lerp(from.zoom, BEATS[i].zoom, t);
      panX = lerp(from.panX, BEATS[i].panX, t);
      panY = lerp(from.panY, BEATS[i].panY, t);
      tint = BEATS[i].tint;
      break;
    }
    if (progress > center && progress <= nextCenter) {
      const t = (progress - center) / (nextCenter - center);
      const to = i < BEATS.length - 1 ? BEATS[i + 1] : { zoom: 1.05, panX: 0, panY: 0, tint: 'rgba(0,0,0,0)' };
      zoom = lerp(BEATS[i].zoom, to.zoom, t);
      panX = lerp(BEATS[i].panX, to.panX, t);
      panY = lerp(BEATS[i].panY, to.panY, t);
      tint = t > 0.5 ? to.tint : BEATS[i].tint;
      break;
    }
  }

  return { zoom, panX, panY, tint };
}

export function ScrollVideoStory() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<(HTMLImageElement | null)[]>(new Array(TOTAL_FRAMES).fill(null));
  const smoothFrameRef = useRef(0); // lerped frame for dreamy feel
  const lastRawFrameRef = useRef(0);
  const beatRefs = useRef<(HTMLDivElement | null)[]>([]);
  const wordRefs = useRef<HTMLSpanElement[][]>([[], [], [], []]);
  const scrollHintRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const beatDotsRef = useRef<(HTMLDivElement | null)[]>([]);
  const tintRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const rafIdRef = useRef(0);

  const [preloaded, setPreloaded] = useState(false);
  const [introGone, setIntroGone] = useState(false);

  // ── Lenis smooth scroll (scoped to this page) ──
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.4,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    function raf(time: number) {
      lenis.raf(time);
      rafIdRef.current = requestAnimationFrame(raf);
    }
    rafIdRef.current = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafIdRef.current);
      lenis.destroy();
    };
  }, []);

  // ── Preload frames ──
  useEffect(() => {
    let mounted = true;
    const images = imagesRef.current;

    function loadImage(index: number): Promise<void> {
      return new Promise((resolve) => {
        const img = new window.Image();
        img.src = `${FRAME_PATH}${String(index + 1).padStart(4, '0')}.jpg`;
        img.onload = () => { if (mounted) images[index] = img; resolve(); };
        img.onerror = () => resolve();
      });
    }

    async function preload() {
      // First 40 frames — enough for intro
      await Promise.all(Array.from({ length: 40 }, (_, i) => loadImage(i)));
      if (!mounted) return;
      setPreloaded(true);
      // Intro dismisses on first scroll, not a timer
      function onFirstScroll() {
        if (mounted) setIntroGone(true);
        window.removeEventListener('scroll', onFirstScroll);
      }
      window.addEventListener('scroll', onFirstScroll, { passive: true });
      // Fallback: auto-dismiss after 4s if user doesn't scroll
      setTimeout(() => { if (mounted) { setIntroGone(true); window.removeEventListener('scroll', onFirstScroll); } }, 4000);

      // Rest in batches
      const remaining = Array.from({ length: TOTAL_FRAMES - 40 }, (_, i) => i + 40);
      for (let i = 0; i < remaining.length; i += 30) {
        await Promise.all(remaining.slice(i, i + 30).map(loadImage));
        if (!mounted) return;
      }
    }

    preload();
    return () => { mounted = false; };
  }, []);

  // ── Render loop ──
  useEffect(() => {
    if (!preloaded) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    ctxRef.current = ctx;

    function sizeCanvas() {
      if (!canvas || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawWithCamera(img: HTMLImageElement, camera: { zoom: number; panX: number; panY: number }) {
      if (!canvas || !ctx) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const baseScale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const scale = baseScale * camera.zoom;
      const sw = img.naturalWidth * scale;
      const sh = img.naturalHeight * scale;
      const maxPanX = (sw - w) / 2;
      const maxPanY = (sh - h) / 2;
      ctx.drawImage(img, (w - sw) / 2 + camera.panX * maxPanX, (h - sh) / 2 + camera.panY * maxPanY, sw, sh);
    }

    function findNearestFrame(idx: number): HTMLImageElement | null {
      if (imagesRef.current[idx]) return imagesRef.current[idx];
      for (let offset = 1; offset < 15; offset++) {
        if (imagesRef.current[idx - offset]) return imagesRef.current[idx - offset];
        if (imagesRef.current[idx + offset]) return imagesRef.current[idx + offset];
      }
      return null;
    }

    // Continuous render loop (not just on scroll — needed for lerp smoothing)
    let running = true;

    function renderLoop() {
      if (!running || !container) return;

      const rect = container.getBoundingClientRect();
      const scrollable = container.offsetHeight - window.innerHeight;
      if (scrollable <= 0) { requestAnimationFrame(renderLoop); return; }
      const progress = Math.max(0, Math.min(1, -rect.top / scrollable));

      // ── Lerped frame (dreamy catch-up) ──
      const targetFrame = progress * (TOTAL_FRAMES - 1);
      smoothFrameRef.current += (targetFrame - smoothFrameRef.current) * 0.1;
      const frameIndex = Math.round(smoothFrameRef.current);

      // ── Draw frame with camera ──
      const camera = getCameraState(progress);
      const img = findNearestFrame(frameIndex);
      if (img) drawWithCamera(img, camera);

      // ── Color mood tint ──
      if (tintRef.current) {
        tintRef.current.style.background = camera.tint;
      }

      // ── Word-by-word text reveals ──
      let activeBeat = -1;
      for (let i = 0; i < BEATS.length; i++) {
        const beatProgress = getBeatProgress(progress, BEATS[i]);
        const enterProgress = getEnterProgress(progress, BEATS[i]);
        const isExiting = progress >= BEATS[i].exitStart;

        const el = beatRefs.current[i];
        if (el) {
          if (beatProgress <= 0) {
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
          } else {
            el.style.opacity = '1';
            el.style.pointerEvents = 'none';

            // Exit: whole block fades up
            if (isExiting) {
              const exitT = Math.pow((progress - BEATS[i].exitStart) / (BEATS[i].exitEnd - BEATS[i].exitStart), 2);
              el.style.transform = `translateY(${lerp(0, -40, exitT)}px) scale(${lerp(1, 0.97, exitT)})`;
              el.style.filter = exitT > 0.05 ? `blur(${lerp(0, 6, exitT)}px)` : 'none';
              // Fade all words together on exit
              const words = wordRefs.current[i];
              for (const w of words) {
                w.style.opacity = String(1 - exitT);
                w.style.transform = `translateY(${lerp(0, -8, exitT)}px)`;
              }
            } else {
              el.style.transform = 'translateY(0) scale(1)';
              el.style.filter = 'none';

              // ── Per-word stagger on enter ──
              const words = wordRefs.current[i];
              const wordCount = words.length;
              for (let w = 0; w < wordCount; w++) {
                const wordStart = w / (wordCount + 1);
                const wordEnd = (w + 2) / (wordCount + 1);
                const wordT = Math.max(0, Math.min(1, (enterProgress - wordStart) / (wordEnd - wordStart)));
                const eased = 1 - Math.pow(1 - wordT, 3);
                words[w].style.opacity = String(eased);
                words[w].style.transform = `translateY(${lerp(20, 0, eased)}px)`;
                words[w].style.filter = eased < 0.9 ? `blur(${lerp(3, 0, eased)}px)` : 'none';
              }
            }
          }
        }
        if (beatProgress > 0.3) activeBeat = i;
      }

      // ── Beat dots ──
      for (let i = 0; i < BEATS.length; i++) {
        const dot = beatDotsRef.current[i];
        if (dot) {
          const isActive = i === activeBeat;
          dot.style.width = isActive ? '20px' : '4px';
          dot.style.opacity = isActive ? '1' : '0.3';
          dot.style.background = isActive ? 'white' : 'rgba(255,255,255,0.5)';
        }
      }

      // ── Progress bar ──
      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${progress})`;
        progressBarRef.current.style.opacity = progress > 0.01 && progress < 0.95 ? '1' : '0';
      }

      // ── Scale-down exit ──
      if (stickyRef.current) {
        if (progress > 0.90) {
          const exitT = (progress - 0.90) / 0.10;
          const scale = lerp(1, 0.94, exitT);
          const radius = lerp(0, 24, exitT);
          stickyRef.current.style.transform = `scale(${scale})`;
          stickyRef.current.style.borderRadius = `${radius}px`;
        } else {
          stickyRef.current.style.transform = 'scale(1)';
          stickyRef.current.style.borderRadius = '0px';
        }
      }

      // Scroll hint
      if (scrollHintRef.current) {
        scrollHintRef.current.style.opacity = progress < 0.03 ? '1' : '0';
      }
      // Bottom fade
      if (fadeRef.current) {
        fadeRef.current.style.opacity = progress > 0.88
          ? String(Math.min(1, (progress - 0.88) * 8))
          : '0';
      }

      requestAnimationFrame(renderLoop);
    }

    sizeCanvas();
    smoothFrameRef.current = 0;
    renderLoop();

    window.addEventListener('resize', sizeCanvas);
    return () => {
      running = false;
      window.removeEventListener('resize', sizeCanvas);
    };
  }, [preloaded, introGone]);

  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return null;
  }

  const beatBase: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    opacity: 0,
    willChange: 'transform, opacity, filter',
  };

  // Layered text shadows — crisp edge + deep glow + ambient spread
  const shadow = '0 1px 2px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.5), 0 12px 48px rgba(0,0,0,0.4)';
  const shadowLight = '0 1px 4px rgba(0,0,0,0.5), 0 4px 20px rgba(0,0,0,0.3)';

  /** Render words as individual spans for per-word reveal */
  function renderWords(beatIndex: number, words: string[], className: string, extraStyle?: React.CSSProperties) {
    return (
      <span className={className} style={extraStyle}>
        {words.map((word, w) => (
          <span
            key={w}
            ref={(el) => { if (el) { if (!wordRefs.current[beatIndex]) wordRefs.current[beatIndex] = []; wordRefs.current[beatIndex][w] = el; } }}
            className="inline-block"
            style={{ opacity: 0, willChange: 'transform, opacity, filter' }}
          >
            {word}{w < words.length - 1 ? '\u00A0' : ''}
          </span>
        ))}
      </span>
    );
  }

  return (
    <div ref={containerRef} style={{ height: `${getScrollHeight()}vh` }} className="relative bg-black">
      {/* Sticky viewport — scales down on exit */}
      <div
        ref={stickyRef}
        className="sticky top-0 h-screen w-full overflow-hidden bg-black"
        style={{ willChange: 'transform, border-radius' }}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />

        {/* Vignette — 3 layers for depth */}
        {/* Layer 1: Edge vignette — darkens corners and edges */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 70% 60% at center, transparent 0%, rgba(0,0,0,0.55) 100%)',
          }}
        />
        {/* Layer 2: Top/bottom bars — cinematic letterbox feel */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 18%, transparent 82%, rgba(0,0,0,0.45) 100%)',
          }}
        />
        {/* Layer 3: Subtle center darkening — ensures text readability over bright footage */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at center, rgba(0,0,0,0.18) 0%, transparent 70%)',
          }}
        />

        {/* Color mood tint — per beat */}
        <div ref={tintRef} className="absolute inset-0 pointer-events-none transition-none" />

        {/* ── Story Beats ── */}
        <div className="absolute inset-0 z-10 pointer-events-none">

          {/* Beat 1: CENTER — brand statement, large with italic contrast */}
          <div ref={(el) => { beatRefs.current[0] = el; }} style={{ ...beatBase, alignItems: 'center', justifyContent: 'center' }}>
            <div className="text-center px-6 max-w-3xl">
              {renderWords(0, BEAT_WORDS[0],
                'text-[clamp(2.75rem,7vw,5.5rem)] font-extrabold text-white leading-[1.0] tracking-[-0.03em] block',
                { textShadow: shadow, fontStyle: 'normal' }
              )}
            </div>
          </div>

          {/* Beat 2: BOTTOM LEFT — editorial with overline + thin rule */}
          <div ref={(el) => { beatRefs.current[1] = el; }} style={{ ...beatBase, alignItems: 'flex-end', justifyContent: 'flex-start' }}>
            <div className="px-8 sm:px-16 pb-24 sm:pb-32 max-w-lg">
              <div className="w-10 h-px bg-white/30 mb-5" />
              <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/40 mb-3" style={{ textShadow: shadowLight }}>
                From kitchen to table
              </p>
              {renderWords(1, BEAT_WORDS[1],
                'text-[clamp(1.75rem,4.5vw,3.25rem)] font-bold text-white leading-[1.1] tracking-[-0.02em] text-left block',
                { textShadow: shadow }
              )}
            </div>
          </div>

          {/* Beat 3: RIGHT — stacked with weight variation */}
          <div ref={(el) => { beatRefs.current[2] = el; }} style={{ ...beatBase, alignItems: 'center', justifyContent: 'flex-end' }}>
            <div className="pr-8 sm:pr-16 lg:pr-24 text-right max-w-lg">
              {renderWords(2, BEAT_WORDS[2],
                'text-[clamp(2rem,5vw,3.75rem)] text-white leading-[1.25] tracking-[-0.02em] block',
                { textShadow: shadow }
              )}
              <div className="w-10 h-px bg-white/25 mt-6 ml-auto" />
            </div>
          </div>

          {/* Beat 4: CENTER — confident closer, tighter tracking */}
          <div ref={(el) => { beatRefs.current[3] = el; }} style={{ ...beatBase, alignItems: 'center', justifyContent: 'center' }}>
            <div className="text-center px-6 max-w-xl space-y-5">
              {renderWords(3, BEAT_WORDS[3],
                'text-[clamp(2.25rem,5.5vw,4.5rem)] font-extrabold text-white tracking-[-0.03em] block',
                { textShadow: shadow }
              )}
              <div className="mx-auto w-8 h-px bg-white/25" />
              <p className="text-sm sm:text-base text-white/45 font-light tracking-[0.05em]" style={{ textShadow: shadowLight }}>
                Welcome to the experience
              </p>
            </div>
          </div>
        </div>

        {/* Beat dots — right edge */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none">
          {BEATS.map((_, i) => (
            <div
              key={i}
              ref={(el) => { beatDotsRef.current[i] = el; }}
              className="rounded-full transition-all duration-300"
              style={{ width: '4px', height: '4px', opacity: 0.3, background: 'rgba(255,255,255,0.5)' }}
            />
          ))}
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/10 z-20">
          <div
            ref={progressBarRef}
            className="h-full bg-white/40 origin-left transition-opacity duration-300"
            style={{ transform: 'scaleX(0)', opacity: 0 }}
          />
        </div>

        {/* Scroll hint */}
        <div
          ref={scrollHintRef}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10 transition-opacity duration-500"
          style={{ opacity: 0 }}
        >
          <span className="text-xs font-medium text-white/50 uppercase tracking-[0.2em]">Scroll</span>
          <div className="w-5 h-8 rounded-full border-2 border-white/25 flex items-start justify-center pt-1.5">
            <div className="w-1 h-1.5 rounded-full bg-white/50 animate-bounce" />
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div
          ref={fadeRef}
          className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none z-10"
          style={{
            background: 'linear-gradient(to bottom, transparent, var(--public-bg, #faf8f5))',
            opacity: 0,
          }}
        />
      </div>

      {/* Intro blackout */}
      <AnimatePresence>
        {!introGone && (
          <motion.div
            exit={{ y: '-100%' }}
            transition={{ duration: 1.2, ease: [0.76, 0, 0.24, 1] }}
            className="fixed inset-0 z-[60] bg-[#080808] flex flex-col items-center justify-center gap-6"
          >
            <motion.h1
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="text-[clamp(1.5rem,4vw,2.5rem)] font-extrabold text-white tracking-[-0.02em] uppercase"
              style={{ letterSpacing: '0.08em' }}
            >
              Konma Xperience
            </motion.h1>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="w-12 h-px bg-white/20 origin-center"
            />
            {!preloaded ? (
              <>
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.0, duration: 0.6 }}
                  className="text-[11px] text-white/30 font-light tracking-[0.3em] uppercase"
                >
                  Loading
                </motion.span>
                <div className="w-32 h-px bg-white/8 rounded-full overflow-hidden mt-1">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: '35%' }}
                    transition={{ duration: 6, ease: 'easeOut' }}
                    className="h-full bg-white/30 rounded-full"
                  />
                </div>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="flex flex-col items-center gap-3 mt-2"
              >
                <span className="text-[11px] text-white/30 font-light tracking-[0.3em] uppercase">
                  Scroll to begin
                </span>
                <motion.div
                  animate={{ y: [0, 6, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-4 h-7 rounded-full border border-white/20 flex items-start justify-center pt-1"
                >
                  <div className="w-0.5 h-1.5 rounded-full bg-white/40" />
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
