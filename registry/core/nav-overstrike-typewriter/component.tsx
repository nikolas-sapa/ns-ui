"use client";

import { useLayoutEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// NavOverstrikeTypewriter — a real site nav whose backing strip is rendered
// as typewriter OVERSTRIKE shading: striking several characters into the
// same cell without advancing the carriage, so their ink compounds into a
// denser mark. This is a real technique from typewriter-art practice (e.g.
// "M" over "8" over ":" to fake a mid-tone the machine's fixed character set
// has no single glyph for) — it is NOT this registry's usual glyph-density
// ramp, where one glyph is picked off an ordered list by luminance. Every
// cell here gets 1-3 *separate* fillText passes composited on top of each
// other with independent jitter and alpha, so coverage genuinely compounds
// where strokes overlap — a fake version would just look up a single denser
// glyph, which is exactly the mechanic this component exists to be distinct
// from.
//
// The strip sits as a thin ruled line beneath the real link row, one column
// band per nav item. The item carrying aria-current="page" always strikes
// at the deepest stack (3 passes) — "the active item is whichever cells
// carry the deepest overstrike stack" is not a metaphor, it is literally how
// the current-page indicator reads. A slow ping-pong sweep — a carriage
// returning and going back over the line — passes across the strip
// continuously, giving every cell it crosses one extra, freshly-chosen
// overstrike pass that fades with proximity, so the strip visibly re-types
// itself at rest without ever using --ns-accent (interaction-only) in the
// ambient field.
//
// House idiom duplicated on purpose (no shared helpers, per project
// convention): cell metrics via an offscreen measureText after
// document.fonts.ready, tokens via getComputedStyle + a MutationObserver on
// documentElement's class, one rAF loop paused on document visibilitychange.
// ---------------------------------------------------------------------------

export interface NavOverstrikeTypewriterLink {
  href: string;
  label: string;
  /** marks this item as the current page — also the deepest overstrike stack */
  current?: boolean;
}

export interface NavOverstrikeTypewriterProps {
  /** brand text on the left */
  wordmark?: string;
  /** nav links, in order */
  links?: NavOverstrikeTypewriterLink[];
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const DEFAULT_LINKS: NavOverstrikeTypewriterLink[] = [
  { href: "#work", label: "Work", current: true },
  { href: "#process", label: "Process" },
  { href: "#pricing", label: "Pricing" },
  { href: "#contact", label: "Contact" },
];

// Characters real overstrike shading actually reaches for: tall, ink-heavy
// letterforms and punctuation a typewriter's fixed set would stack to fake
// tone the machine has no single glyph for.
const GLYPH_POOL = ["M", "W", "N", "H", "K", "X", "#", "8", "%", "&", ":", ".", "-", "+", "/"];

const BASE_STACK_MIN = 1;
const BASE_STACK_MAX = 2;
const ACTIVE_STACK = 3;
const MAX_STACK = 3;
const JITTER_PX = 1.3;
const SWEEP_PERIOD_MS = 7200; // one carriage return + return-stroke, full cycle
const SWEEP_SIGMA = 26; // px, width of the re-strike kernel around the carriage
// Reduced motion freezes here rather than at t=0: at this sweep phase the
// carriage sits clear of the active item's own permanent 3-stack, so a
// single static frame shows BOTH cues at once — the always-deep active
// column and a freshly re-struck ambient cell — rather than a blank strip
// or the two effects coinciding and looking like one.
const STATIC_SWEEP_T = 0.63;

function hash32(x: number): number {
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = x ^ (x >>> 16);
  return x >>> 0;
}

function glyphFor(seed: number): string {
  return GLYPH_POOL[hash32(seed) % GLYPH_POOL.length];
}

function jitterFor(seed: number): number {
  const h = hash32(seed + 0x2545f4);
  return ((h % 1000) / 1000 - 0.5) * JITTER_PX * 2;
}

// Triangle wave: 0 -> 1 -> 0 over one period, like a carriage sweeping right
// then returning left rather than snapping back.
function triangle(t: number): number {
  const p = t * 2;
  return p > 1 ? 2 - p : p;
}

export function NavOverstrikeTypewriter({
  wordmark = "ns-ui",
  links = DEFAULT_LINKS,
  className = "",
}: NavOverstrikeTypewriterProps) {
  const navRef = useRef<HTMLElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const linkRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());

  // token derive happens in useLayoutEffect, before first paint, so no rAF /
  // ResizeObserver / reduced-motion branch can draw with an empty ink string
  useLayoutEffect(() => {
    const strip = stripRef.current;
    const canvas = canvasRef.current;
    if (!strip || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const offscreen = document.createElement("canvas").getContext("2d");
    if (!offscreen) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let fg = "";
    let muted = "";
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = cs.getPropertyValue("--foreground").trim();
      muted = cs.getPropertyValue("--ns-muted").trim();
    };
    readTokens();

    let disposed = false;
    let raf = 0;
    let dpr = 1;
    let cssW = 0;
    let cssH = 0;
    let cellW = 0;
    let cellH = 0;
    let cols = 0;
    let fontPx = 12;
    let activeStart = -1;
    let activeEnd = -1;

    const computeActiveRange = () => {
      const activeEl = strip
        .closest("nav")
        ?.querySelector<HTMLAnchorElement>('a[aria-current="page"]');
      if (!activeEl || !cellW) {
        activeStart = -1;
        activeEnd = -1;
        return;
      }
      const canvasRect = canvas.getBoundingClientRect();
      const linkRect = activeEl.getBoundingClientRect();
      const startPx = linkRect.left - canvasRect.left;
      const endPx = linkRect.right - canvasRect.left;
      activeStart = Math.max(0, Math.floor(startPx / cellW));
      activeEnd = Math.min(cols, Math.ceil(endPx / cellW));
    };

    const computeGrid = () => {
      const rect = canvas.getBoundingClientRect();
      cssW = rect.width;
      cssH = rect.height;
      if (cssW <= 0 || cssH <= 0) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // font size derived proportionally from the strip's own measured
      // height, never a fixed px constant — keeps the mark compact rather
      // than turning into a coarse zoomed-in grid on a narrow nav.
      fontPx = Math.max(9, Math.min(14, Math.round(cssH * 0.62)));
      offscreen.font = `${fontPx}px var(--font-mono), "GeistMono", ui-monospace, monospace`;
      const m = offscreen.measureText("M");
      cellW = Math.max(7, m.width * 1.55);
      cellH = cssH;
      cols = Math.max(1, Math.floor(cssW / cellW));
      cellW = cssW / cols; // even division across the full strip width

      ctx.font = `${fontPx}px var(--font-mono), "GeistMono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      computeActiveRange();
    };

    const drawCell = (col: number, stackDepth: number, extraSeedBucket: number) => {
      const cx = col * cellW + cellW / 2;
      const cy = cellH / 2;
      for (let pass = 0; pass < stackDepth; pass++) {
        const seed = col * 977 + pass * 131 + extraSeedBucket * 31;
        const glyph = glyphFor(seed);
        const dx = jitterFor(seed);
        const dy = jitterFor(seed + 1);
        ctx.fillStyle = pass % 2 === 0 ? fg : muted;
        ctx.globalAlpha = 0.3 - pass * 0.05;
        ctx.fillText(glyph, cx + dx, cy + dy);
      }
      ctx.globalAlpha = 1;
    };

    const draw = (nowMs: number, sweepTOverride?: number) => {
      if (cols <= 0) return;
      ctx.clearRect(0, 0, cssW, cssH);
      const sweepT = sweepTOverride ?? triangle((nowMs % SWEEP_PERIOD_MS) / SWEEP_PERIOD_MS);
      const sweepX = sweepT * cssW;
      // a coarse time bucket, not per-frame, so a re-struck cell holds its
      // freshly-picked glyph for a beat instead of flickering every 16ms
      const bucket = Math.floor(nowMs / 420);

      for (let c = 0; c < cols; c++) {
        const isActive = c >= activeStart && c < activeEnd;
        let depth = isActive
          ? ACTIVE_STACK
          : BASE_STACK_MIN + (hash32(c) % 2 === 0 ? 0 : BASE_STACK_MAX - BASE_STACK_MIN);

        const cellCx = c * cellW + cellW / 2;
        const dist = Math.abs(cellCx - sweepX);
        const kernel = Math.exp(-(dist * dist) / (2 * SWEEP_SIGMA * SWEEP_SIGMA));
        const restruck = kernel > 0.12;
        if (restruck) depth = Math.min(MAX_STACK, depth + 1);

        drawCell(c, depth, restruck ? bucket : c);
      }
    };

    const loop = (ts: number) => {
      if (disposed || document.hidden) return;
      draw(ts);
      raf = requestAnimationFrame(loop);
    };

    const onVis = () => {
      if (!document.hidden && !reduced && !disposed) raf = requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", onVis);

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        computeGrid();
        if (reduced) draw(0, STATIC_SWEEP_T);
      }, 100);
    });
    ro.observe(strip);

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw(0, STATIC_SWEEP_T);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    document.fonts.ready.then(() => {
      if (disposed) return;
      computeGrid();
      if (reduced) {
        draw(0, STATIC_SWEEP_T);
      } else {
        raf = requestAnimationFrame(loop);
      }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [links]);

  return (
    <nav
      ref={navRef}
      aria-label="Primary"
      className={`relative w-full border-b border-border bg-background ${className}`}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-4">
        <a
          href="#top"
          className="shrink-0 rounded-sm font-mono text-[15px] font-semibold tracking-tight text-foreground transition-colors duration-150 hover:text-ns-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ns-accent"
        >
          {wordmark}
        </a>
        <ul className="flex items-center gap-7">
          {links.map((link) => (
            <li key={link.href}>
              <a
                ref={(el) => {
                  if (el) linkRefs.current.set(link.href, el);
                  else linkRefs.current.delete(link.href);
                }}
                href={link.href}
                aria-current={link.current ? "page" : undefined}
                className={`rounded-sm text-sm transition-colors duration-150 hover:text-foreground focus-visible:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ns-accent ${
                  link.current ? "text-foreground" : "text-ns-muted"
                }`}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* decorative overstrike strip — a ruled typed line beneath the real
          links, aria-hidden. It illustrates which item is current (deepest
          stack) and that the strip is alive at rest (the re-strike sweep);
          it never carries navigation semantics of its own. */}
      <div ref={stripRef} aria-hidden="true" className="relative mx-auto mt-2 h-5 w-full max-w-6xl px-6">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>
    </nav>
  );
}
