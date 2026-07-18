"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// ScanSweepStats — dashboard KPI grid under an observatory radar. A Canvas 2D
// layer beneath the DOM card grid sweeps a 1px accent arm (30°/s, one
// revolution per 12s) trailed by a 24° foreground wedge, with sonar rings
// emitted once per revolution. Each card's bearing from the top-left pivot is
// measured from DOM rects (offset coords, re-measured on resize); when the
// arm transits within ±2° the card wakes: value counts up over 900ms
// ease-out-expo, border tweens --border→--accent (200ms) then decays back
// (1.6s), and the trend delta fades in — one reading per pass, resting muted
// between transits. Hover/focus replays the count-up without the accent
// border (accent is sweep-earned only). Rings and wedge live in pruned lists
// drawn onto fully cleared frames — no destination-in accumulation. Refs-only
// hot path; the loop pauses offscreen/hidden and sleeps while paused once all
// card tweens hit their hard end times.
// ---------------------------------------------------------------------------

type RGB = { r: number; g: number; b: number };

function parseColor(raw: string): RGB | null {
  const v = raw.trim();
  if (v.startsWith("#")) {
    const hex = v.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0]! + hex[0]!, 16);
      const g = parseInt(hex[1]! + hex[1]!, 16);
      const b = parseInt(hex[2]! + hex[2]!, 16);
      if (Number.isNaN(r + g + b)) return null;
      return { r, g, b };
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (Number.isNaN(r + g + b)) return null;
      return { r, g, b };
    }
    return null;
  }
  const m = v.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (!m) return null;
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
}

function rgba(c: RGB, a: number): string {
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export type ScanStat = {
  label: string;
  /** numeric target the count-up eases toward */
  value: number;
  /** formats the interpolated value for display (defaults to locale string) */
  format?: (v: number) => string;
  /** trend string, e.g. "+4.2%" — fades in on each transit */
  delta?: string;
  /** small stroke icon rendered before the label */
  icon?: ReactNode;
};

const defaultFormat = (v: number) =>
  v.toLocaleString("en-US", { maximumFractionDigits: 1 });

function strokeIcon(children: ReactNode) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const DEFAULT_STATS: ScanStat[] = [
  {
    label: "Revenue",
    value: 128.4,
    format: (v) => `$${v.toFixed(1)}k`,
    delta: "+4.2%",
    icon: strokeIcon(
      <>
        <polyline points="3 17 9 11 13 15 21 7" />
        <polyline points="15 7 21 7 21 13" />
      </>
    ),
  },
  {
    label: "p95 latency",
    value: 182,
    format: (v) => `${Math.round(v)}ms`,
    delta: "-11ms",
    icon: strokeIcon(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 12V6.5" />
        <path d="m12 12 3.5 2" />
      </>
    ),
  },
  {
    label: "Uptime",
    value: 99.98,
    format: (v) => `${v.toFixed(2)}%`,
    icon: strokeIcon(
      <polyline points="3 12 7 12 10 5 14 19 17 12 21 12" />
    ),
  },
  {
    label: "Churn",
    value: 1.2,
    format: (v) => `${v.toFixed(1)}%`,
    delta: "-0.1",
    icon: strokeIcon(
      <>
        <path d="M7 7l10 10" />
        <polyline points="17 9 17 17 9 17" />
      </>
    ),
  },
  {
    label: "Active nodes",
    value: 3412,
    format: (v) => Math.round(v).toLocaleString("en-US"),
    delta: "+86",
    icon: strokeIcon(
      <>
        <circle cx="6" cy="12" r="2.5" />
        <circle cx="18" cy="5.5" r="2.5" />
        <circle cx="18" cy="18.5" r="2.5" />
        <path d="M8.2 10.9l7.5-4.2M8.2 13.1l7.5 4.2" />
      </>
    ),
  },
  {
    label: "Error rate",
    value: 0.07,
    format: (v) => `${v.toFixed(2)}%`,
    icon: strokeIcon(
      <>
        <path d="M12 3.5 2.8 19.5h18.4Z" />
        <path d="M12 10v4" />
        <path d="M12 16.8v.2" />
      </>
    ),
  },
];

// pivot sits at the panel's top-left padding corner (p-6 = 24px)
const PIVOT = 24;
const COUNT_MS = 900; // value count-up
const DELTA_MS = 300; // trend delta fade-in
const BORDER_IN_MS = 200; // --border → --accent
const BORDER_OUT_MS = 1600; // decay back to --border
const TWEEN_MS = BORDER_IN_MS + BORDER_OUT_MS; // hard end for every wake
const RING_SPEED = 320; // px/s expansion
const RING_ALPHA = 0.18;
const MAX_RINGS = 3;

export function ScanSweepStats({
  stats = DEFAULT_STATS,
  title = "Network observatory",
  degPerSec = 30,
  wedgeDeg = 24,
  toleranceDeg = 2,
  className = "",
}: {
  /** KPI cards, clockwise activation order falls out of their bearings */
  stats?: ScanStat[];
  title?: string;
  /** sweep speed in degrees per second (30 = one revolution per 12s) */
  degPerSec?: number;
  /** soft sector width trailing the arm, in degrees */
  wedgeDeg?: number;
  /** transit window around a card's bearing, in degrees */
  toleranceDeg?: number;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const sweepRef = useRef<HTMLSpanElement>(null);
  const cardEls = useRef<(HTMLDivElement | null)[]>([]);
  const pausedRef = useRef(false);
  const wakeRef = useRef<(() => void) | null>(null);
  const [paused, setPaused] = useState(false);

  const togglePause = () => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    wakeRef.current?.(); // redraw the frozen frame / resume the sweep
  };

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // UTC clock — a 1Hz text swap, torn down with the effect
    const clockTick = () => {
      if (clockRef.current) {
        clockRef.current.textContent = `${new Date()
          .toISOString()
          .slice(11, 19)} UTC`;
      }
    };
    clockTick();
    const clockId = window.setInterval(clockTick, 1000);

    if (reduced) {
      // static fallback: no sweep, no rings, no loop. Cards render settled at
      // their server-marked final values with static --border; hover raise
      // stays pure CSS. The canvas draws nothing.
      return () => window.clearInterval(clockId);
    }

    // ---- token inks: derived at mount, re-derived live on class flips ------
    let fg: RGB = { r: 237, g: 237, b: 237 };
    let accent: RGB = { r: 0, g: 107, b: 255 };
    let borderC: RGB = { r: 46, g: 46, b: 46 };
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
      accent = parseColor(cs.getPropertyValue("--accent")) ?? accent;
      borderC = parseColor(cs.getPropertyValue("--border")) ?? borderC;
    };
    derive();

    // ---- card records: DOM handles + tween state, refs only ----------------
    type Rec = {
      el: HTMLDivElement;
      valueEl: HTMLElement;
      deltaEl: HTMLElement | null;
      target: number;
      format: (v: number) => string;
      angle: number; // bearing from pivot, 0..360°
      next: number; // next unwrapped transit angle (Infinity until measured)
      active: boolean;
      accent: boolean; // sweep-earned border glow vs plain hover replay
      wakeAt: number;
      lastText: string;
    };
    const records: Rec[] = [];
    stats.forEach((s, i) => {
      const el = cardEls.current[i];
      if (!el) return;
      const valueEl = el.querySelector<HTMLElement>("[data-value]");
      if (!valueEl) return;
      records.push({
        el,
        valueEl,
        deltaEl: el.querySelector<HTMLElement>("[data-delta]"),
        target: s.value,
        format: s.format ?? defaultFormat,
        angle: 0,
        next: Number.POSITIVE_INFINITY,
        active: false,
        accent: false,
        wakeAt: 0,
        lastText: "",
      });
    });

    // ---- geometry / sizing -------------------------------------------------
    let w = 0;
    let h = 0;
    let dpr = 1;
    let maxR = 0;
    let sized = false;
    let T = 0; // unwrapped sweep angle in degrees, monotonic
    let lastRev = 0;
    const rings: { r: number }[] = [{ r: 0 }]; // one live ring at mount

    const measure = () => {
      const rr = root.getBoundingClientRect();
      if (rr.width < 2 || rr.height < 2) {
        sized = false; // zero-size guard — loop no-ops until RO wakes us
        return;
      }
      w = rr.width;
      h = rr.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      // canvas is a replaced element — inset does not size it; explicit CSS
      // size keeps the dpr backing store from rendering at raw scale
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      maxR = Math.hypot(w, h);
      // card bearings from panel-relative rects (offset coords, never page)
      const phase = ((T % 360) + 360) % 360;
      for (const c of records) {
        const cr = c.el.getBoundingClientRect();
        const dx = cr.left - rr.left + cr.width / 2 - PIVOT;
        const dy = cr.top - rr.top + cr.height / 2 - PIVOT;
        c.angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
        c.next = T + ((c.angle - phase + 360) % 360);
      }
      sized = true;
    };
    measure();

    // ---- painting: full clear each frame, pruned lists re-stroked ----------
    const DEG = Math.PI / 180;
    const draw = () => {
      if (!sized) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h); // explicit clear — no destination-in fading
      const a = (((T % 360) + 360) % 360) * DEG;
      const wr = wedgeDeg * DEG;

      // wedge: soft angular gradient trailing the arm, foreground 0 → 0.10
      let wedgeFill: CanvasGradient | string;
      if (typeof ctx.createConicGradient === "function") {
        const g = ctx.createConicGradient(a - wr, PIVOT, PIVOT);
        const f = wedgeDeg / 360;
        g.addColorStop(0, rgba(fg, 0));
        g.addColorStop(f, rgba(fg, 0.1));
        g.addColorStop(Math.min(1, f + 0.002), rgba(fg, 0));
        g.addColorStop(1, rgba(fg, 0));
        wedgeFill = g;
      } else {
        wedgeFill = rgba(fg, 0.05);
      }
      ctx.beginPath();
      ctx.moveTo(PIVOT, PIVOT);
      ctx.arc(PIVOT, PIVOT, maxR, a - wr, a);
      ctx.closePath();
      ctx.fillStyle = wedgeFill;
      ctx.fill();

      // sonar rings — stroked, alpha 0.18 → 0 across their travel
      ctx.lineWidth = 1;
      for (const ring of rings) {
        const alpha = RING_ALPHA * Math.max(0, 1 - ring.r / maxR);
        if (alpha <= 0.002 || ring.r <= 0) continue;
        ctx.beginPath();
        ctx.arc(PIVOT, PIVOT, ring.r, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(fg, alpha);
        ctx.stroke();
      }

      // arm: 1px leading line — the only accent ink in the piece
      ctx.beginPath();
      ctx.moveTo(PIVOT, PIVOT);
      ctx.lineTo(PIVOT + Math.cos(a) * maxR, PIVOT + Math.sin(a) * maxR);
      ctx.strokeStyle = rgba(accent, 0.9);
      ctx.stroke();
    };

    // ---- card wake + tween ticking (direct DOM, hard end times) ------------
    const wakeCard = (c: Rec, earned: boolean) => {
      // re-targets on a second crossing: wakeAt resets, nothing stacks
      c.active = true;
      c.accent = earned;
      c.wakeAt = performance.now();
      c.valueEl.classList.remove("text-muted");
      c.valueEl.classList.add("text-foreground");
      wake();
    };

    const tickCards = (now: number) => {
      let any = false;
      for (const c of records) {
        if (!c.active) continue;
        const t = now - c.wakeAt;
        if (t >= TWEEN_MS) {
          // forced completion at the stated durations — settle back to rest
          c.active = false;
          const done = c.format(c.target);
          if (c.lastText !== done) {
            c.valueEl.textContent = done;
            c.lastText = done;
          }
          c.el.style.borderColor = ""; // fall back to class border-border
          if (c.deltaEl) c.deltaEl.style.opacity = "1";
          c.valueEl.classList.remove("text-foreground");
          c.valueEl.classList.add("text-muted");
          continue;
        }
        any = true;
        const txt = c.format(
          c.target * easeOutExpo(Math.min(1, t / COUNT_MS))
        );
        if (txt !== c.lastText) {
          c.valueEl.textContent = txt;
          c.lastText = txt;
        }
        if (c.deltaEl) {
          c.deltaEl.style.opacity = String(Math.min(1, t / DELTA_MS));
        }
        if (c.accent) {
          const k =
            t <= BORDER_IN_MS
              ? t / BORDER_IN_MS
              : Math.max(0, 1 - (t - BORDER_IN_MS) / BORDER_OUT_MS);
          const m = mixRGB(borderC, accent, k);
          c.el.style.borderColor = `rgb(${m.r},${m.g},${m.b})`;
        }
      }
      return any;
    };

    // ---- rAF loop: ambient sweep; sleeps offscreen/hidden/paused-settled ---
    let raf = 0;
    let last = 0;
    let visible = true;

    const loop = (now: number) => {
      raf = 0;
      if (!visible || document.hidden || !sized) {
        last = 0;
        return; // observers / visibilitychange wake us
      }
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!pausedRef.current) {
        T += degPerSec * dt;
        const rev = Math.floor(T / 360);
        if (rev > lastRev) {
          lastRev = rev;
          rings.push({ r: 0 }); // one ring per full revolution
          while (rings.length > MAX_RINGS) rings.shift();
          if (sweepRef.current) {
            sweepRef.current.textContent = `SWEEP ${String(rev + 1).padStart(3, "0")}`;
          }
        }
        for (const c of records) {
          if (T + toleranceDeg >= c.next) {
            wakeCard(c, true); // sweep-earned: accent border allowed
            c.next += 360; // logged once per pass — re-arm for next revolution
          }
        }
        for (const ring of rings) ring.r += RING_SPEED * dt;
        for (let i = rings.length - 1; i >= 0; i--) {
          if ((rings[i]?.r ?? 0) > maxR) rings.splice(i, 1); // pruned
        }
      }

      const tweening = tickCards(now);
      draw();

      if (pausedRef.current && !tweening) {
        last = 0;
        return; // frozen frame drawn above — genuinely asleep until resume
      }
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    wakeRef.current = wake;

    // ---- observers + listeners ---------------------------------------------
    const ro = new ResizeObserver(() => {
      measure();
      wake();
    });
    ro.observe(root);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
    });
    io.observe(root);
    const mo = new MutationObserver(() => {
      derive(); // live theme re-derive — next frame paints with new inks
      wake();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const onVis = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    // hover/focus wakes a card immediately — replay only, accent stays earned
    const hoverBound: Array<[HTMLElement, () => void]> = [];
    for (const c of records) {
      const h = () => wakeCard(c, c.active && c.accent);
      c.el.addEventListener("pointerenter", h);
      c.el.addEventListener("focus", h);
      hoverBound.push([c.el, h]);
    }

    wake();

    return () => {
      window.clearInterval(clockId);
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      for (const [el, h] of hoverBound) {
        el.removeEventListener("pointerenter", h);
        el.removeEventListener("focus", h);
      }
      wakeRef.current = null;
    };
  }, [stats, degPerSec, wedgeDeg, toleranceDeg]);

  return (
    <div
      ref={rootRef}
      className={`relative isolate overflow-hidden rounded-md border border-border bg-background ${className}`}
    >
      {/* radar layer — under the card grid, visible in gutters and padding */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-0"
      />
      {/* pivot: click to pause/resume the sweep */}
      <button
        type="button"
        onClick={togglePause}
        aria-pressed={paused}
        aria-label={paused ? "Resume radar sweep" : "Pause radar sweep"}
        className="absolute left-3.5 top-3.5 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors duration-200 hover:border-foreground/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40"
      >
        {paused ? (
          <span aria-hidden className="flex gap-[3px]">
            <span className="h-1.5 w-[2px] bg-current" />
            <span className="h-1.5 w-[2px] bg-current" />
          </span>
        ) : (
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
        )}
      </button>
      <div className="relative z-10 p-6">
        <div className="mb-5 flex items-center gap-3 pl-7">
          <h3 className="text-sm font-medium tracking-tight text-foreground">
            {title}
          </h3>
          {paused ? (
            <span className="font-mono text-[10px] tracking-widest text-muted">
              PAUSED
            </span>
          ) : null}
          <span
            ref={clockRef}
            suppressHydrationWarning
            className="ml-auto font-mono text-[11px] tabular-nums text-muted"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((s, i) => (
            <div
              key={s.label}
              ref={(el) => {
                cardEls.current[i] = el;
              }}
              tabIndex={0}
              role="group"
              aria-label={`${s.label}: ${(s.format ?? defaultFormat)(s.value)}${
                s.delta ? `, ${s.delta}` : ""
              }`}
              className="group relative rounded-md border border-border bg-surface p-4 outline-none focus-visible:ring-1 focus-visible:ring-foreground/40"
            >
              {/* surface-step raise on hover/focus — token-relative, no accent */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-md bg-foreground/[0.045] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
              />
              <div className="relative">
                <div className="flex items-center gap-1.5 text-muted">
                  {s.icon}
                  <span className="font-mono text-[10px] uppercase tracking-widest">
                    {s.label}
                  </span>
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span
                    data-value
                    className="font-mono text-lg tabular-nums text-muted transition-colors duration-500"
                  >
                    {(s.format ?? defaultFormat)(s.value)}
                  </span>
                  {s.delta ? (
                    <span
                      data-delta
                      className="font-mono text-[11px] tabular-nums text-muted"
                    >
                      {s.delta}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between font-mono text-[10px] tracking-widest text-muted">
          <span ref={sweepRef}>SWEEP 001</span>
          <span>
            {stats.length} SENSORS · {Math.round(360 / Math.max(1, degPerSec))}S
            INTERVAL
          </span>
        </div>
      </div>
    </div>
  );
}
