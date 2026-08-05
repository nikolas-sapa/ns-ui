"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// PenLag — a chart-recorder hero. Ruled paper scrolls left at a fixed px/s
// while a mechanical pen chases the live value through a deliberately
// underdamped spring (k=120, c=8): a spike overshoots, quivers, and settles.
// The trace buffer only ever APPENDS what the pen actually drew — the
// tremor, once inked, is never recomputed, only its screen position shifts
// as the paper feeds under a fixed writing point. The pen arm and needle
// carriage are DOM overlays (crisp) on top of the canvas trace (raster).
// ---------------------------------------------------------------------------

type Vec3 = [number, number, number];

function parseColor(raw: string): Vec3 | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0]! + hex[0], 16);
      const g = parseInt(hex[1]! + hex[1], 16);
      const b = parseInt(hex[2]! + hex[2], 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    return null;
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

type Sample = { t: number; v: number };

// underdamped pen spring: zeta = C / (2*sqrt(K)) ≈ 0.365 — overshoots, rings,
// settles. Not a prop: this specific mechanical character IS the component.
const SPRING_K = 120;
const SPRING_C = 8;

const RAIL_INSET = 22; // px reserved at the right edge for the pen carriage
const PAD_Y = 14; // vertical drawing padding inside the strip
const TICK_INTERVAL_S = 5; // seconds between minor time ticks
const RULE_SPACING = 26; // px between horizontal ruled lines
const CURSOR_STEP_PX = 26; // keyboard scrub step
const REDUCED_TICK_MS = 480; // redraw cadence under prefers-reduced-motion
const ANNOUNCE_INTERVAL_MS = 1500;
const TREND_LOOKBACK_MS = 12000;
const SCRUB_ANNOUNCE_THROTTLE_MS = 150;

function formatAge(ms: number): string {
  const s = Math.round(Math.max(0, ms) / 1000);
  if (s < 60) return `-${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `-${m}m${r.toString().padStart(2, "0")}s`;
}

function formatWindowLabel(rangeMs: number): string {
  const min = Math.round(rangeMs / 60000);
  if (min < 1) return `${Math.round(rangeMs / 1000)}-second`;
  return `${min}-minute`;
}

export interface PenLagProps {
  /** the true, unlagged live value the pen chases */
  value: number;
  /** fixed vertical scale — recorder paper is calibrated, not auto-ranging */
  min?: number;
  max?: number;
  unit?: string;
  /** used in the mono readout and the aria-live summary */
  label?: string;
  /** paper feed speed, px/s */
  speed?: number;
  /** window used for the aria-live range/trend summary */
  rangeMs?: number;
  formatValue?: (value: number) => string;
  className?: string;
}

export function PenLag({
  value,
  min = 0,
  max = 500,
  unit = "ms",
  label = "Response time",
  speed = 60,
  rangeMs = 5 * 60 * 1000,
  formatValue,
  className = "h-72",
}: PenLagProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const trendRef = useRef<HTMLSpanElement>(null);
  const rangeRef = useRef<HTMLSpanElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const armRef = useRef<HTMLDivElement>(null);
  const carriageRef = useRef<HTMLDivElement>(null);
  const cursorLineRef = useRef<HTMLDivElement>(null);
  const cursorLabelRef = useRef<HTMLDivElement>(null);

  const valueRef = useRef(value);
  valueRef.current = value;
  const minRef = useRef(min);
  minRef.current = min;
  const maxRef = useRef(max);
  maxRef.current = max;
  const unitRef = useRef(unit);
  unitRef.current = unit;
  const labelRef = useRef(label);
  labelRef.current = label;
  const formatRef = useRef(formatValue);
  formatRef.current = formatValue;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const rangeMsRef = useRef(rangeMs);
  rangeMsRef.current = rangeMs;

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const readout = readoutRef.current;
    const trendEl = trendRef.current;
    const rangeEl = rangeRef.current;
    const status = statusRef.current;
    const arm = armRef.current;
    const carriage = carriageRef.current;
    const cursorLine = cursorLineRef.current;
    const cursorLabel = cursorLabelRef.current;
    if (
      !root ||
      !canvas ||
      !readout ||
      !trendEl ||
      !rangeEl ||
      !status ||
      !arm ||
      !carriage ||
      !cursorLine ||
      !cursorLabel
    ) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const baseLabel = `${labelRef.current} chart recorder strip`;
    root.setAttribute("aria-label", baseLabel);

    // -- token-derived ink: read at mount, re-derived on theme change -------
    let fg: Vec3 = [237, 237, 237];
    let bd: Vec3 = [46, 46, 46];
    let mu: Vec3 = [143, 143, 143];
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
      bd = parseColor(cs.getPropertyValue("--border")) ?? bd;
      mu = parseColor(cs.getPropertyValue("--ns-muted")) ?? mu;
    };
    derive();

    const formatDisplay = (v: number) =>
      formatRef.current
        ? formatRef.current(v)
        : `${Math.round(v)}${unitRef.current}`;

    // -- hot-path state: locals only, never React state ---------------------
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let reducedInterval: ReturnType<typeof setInterval> | undefined;
    let announceInterval: ReturnType<typeof setInterval> | undefined;
    let last = 0;
    let penValue = valueRef.current;
    let penVel = 0;
    const buf: Sample[] = [];
    let reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    let paused = false;

    let cursorX = -1; // px on the strip, -1 = inactive
    let lastScrubAnnounce = 0;
    let lastAnnouncedRounded = Number.NaN;
    let lastAnnouncedTrend = "";

    const plotWidth = () => Math.max(0, w - RAIL_INSET);

    const yFor = (v: number) => {
      const span = maxRef.current - minRef.current;
      const t = span > 1e-9 ? (v - minRef.current) / span : 0.5;
      const clamped = Math.max(-0.1, Math.min(1.1, t));
      const y = PAD_Y + (1 - clamped) * (h - PAD_Y * 2);
      return Math.max(1, Math.min(h - 1, y));
    };

    const xForAge = (ageMs: number) => plotWidth() - (ageMs / 1000) * speedRef.current;

    const pruneBuffer = () => {
      const maxSamples = Math.ceil((rangeMsRef.current / 1000) * 70) + 200;
      if (buf.length > maxSamples + 300) {
        buf.splice(0, buf.length - maxSamples);
      }
    };

    const pushSample = (t: number) => {
      buf.push({ t, v: penValue });
      pruneBuffer();
    };

    const draw = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (w <= 0 || h <= 0) return;
      const pw = plotWidth();

      // ruled paper — horizontal lines are translation-invariant, fixed
      ctx.strokeStyle = `rgba(${bd[0]},${bd[1]},${bd[2]},0.55)`;
      ctx.lineWidth = 1;
      const firstY = h % RULE_SPACING;
      for (let y = firstY; y < h; y += RULE_SPACING) {
        ctx.beginPath();
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(w, Math.round(y) + 0.5);
        ctx.stroke();
      }

      // minor time ticks — scroll with the paper (time-derived, no drift)
      const tickSpacing = speedRef.current * TICK_INTERVAL_S;
      if (tickSpacing > 1) {
        const phase = reduced ? 0 : (now / 1000) * speedRef.current % tickSpacing;
        ctx.strokeStyle = `rgba(${mu[0]},${mu[1]},${mu[2]},0.4)`;
        ctx.lineWidth = 1;
        for (let x = pw - phase; x > -tickSpacing; x -= tickSpacing) {
          ctx.beginPath();
          ctx.moveTo(Math.round(x) + 0.5, h - 9);
          ctx.lineTo(Math.round(x) + 0.5, h);
          ctx.stroke();
        }
      }

      // carriage housing margin — a faint divider at the writing point
      ctx.strokeStyle = `rgba(${bd[0]},${bd[1]},${bd[2]},0.7)`;
      ctx.beginPath();
      ctx.moveTo(Math.round(pw) + 0.5, 0);
      ctx.lineTo(Math.round(pw) + 0.5, h);
      ctx.stroke();

      // trace — walk the buffer newest→oldest, stop once off the left edge.
      // every point drawn here was appended once and never recomputed; only
      // its x (a pure function of age) changes frame to frame.
      const visibleAgeMs = (pw / Math.max(1, speedRef.current)) * 1000;
      ctx.strokeStyle = `rgb(${fg[0]},${fg[1]},${fg[2]})`;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      let started = false;
      for (let i = buf.length - 1; i >= 0; i--) {
        const s = buf[i];
        if (!s) continue;
        const age = now - s.t;
        if (age > visibleAgeMs + 40) break;
        const x = xForAge(age);
        const y = yFor(s.v);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      if (started) ctx.stroke();
    };

    const updateCarriage = () => {
      const pw = plotWidth();
      const nibY = yFor(penValue);
      const railX = pw;
      carriage.style.transform = `translate(${(railX - 5).toFixed(1)}px, ${(nibY - 5).toFixed(1)}px)`;

      const pivotX = w - 4;
      const pivotY = h / 2;
      const dx = railX - pivotX;
      const dy = nibY - pivotY;
      const len = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      arm.style.left = `${pivotX}px`;
      arm.style.top = `${pivotY}px`;
      arm.style.width = `${len.toFixed(1)}px`;
      arm.style.transform = `rotate(${angle}rad)`;
    };

    const findNearest = (targetT: number, now: number): Sample | null => {
      const pw = plotWidth();
      const visibleAgeMs = (pw / Math.max(1, speedRef.current)) * 1000;
      let best: Sample | null = null;
      let bestDiff = Infinity;
      for (let i = buf.length - 1; i >= 0; i--) {
        const s = buf[i];
        if (!s) continue;
        const age = now - s.t;
        if (age > visibleAgeMs + 2000) break;
        const diff = Math.abs(s.t - targetT);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = s;
        } else if (diff > bestDiff + 400) {
          break;
        }
      }
      return best;
    };

    const updateCursor = (now: number) => {
      if (cursorX < 0) {
        cursorLine.style.opacity = "0";
        cursorLabel.style.opacity = "0";
        return;
      }
      const pw = plotWidth();
      const ageMs = ((pw - cursorX) / Math.max(1, speedRef.current)) * 1000;
      const targetT = now - ageMs;
      const best = findNearest(targetT, now);
      if (!best) {
        cursorLine.style.opacity = "0";
        cursorLabel.style.opacity = "0";
        return;
      }
      cursorLine.style.opacity = "1";
      cursorLine.style.transform = `translateX(${cursorX.toFixed(1)}px)`;
      const readingAge = formatAge(now - best.t);
      const readingVal = formatDisplay(best.v);
      cursorLabel.style.opacity = "1";
      const labelW = 90;
      const lx = Math.max(0, Math.min(w - labelW, cursorX - labelW / 2));
      cursorLabel.style.transform = `translateX(${lx.toFixed(1)}px)`;
      cursorLabel.textContent = `${readingAge} · ${readingVal}`;
      root.setAttribute(
        "aria-label",
        `${baseLabel}, ${readingAge}: ${readingVal}`
      );
      if (now - lastScrubAnnounce > SCRUB_ANNOUNCE_THROTTLE_MS) {
        lastScrubAnnounce = now;
        status.textContent = `${labelRef.current} at ${readingAge}: ${readingVal}`;
      }
    };

    const computeSummary = (now: number) => {
      const roundedValue = Math.round(valueRef.current);
      let rangeMin = Infinity;
      let rangeMax = -Infinity;
      const windowStart = now - rangeMsRef.current;
      for (let i = 0; i < buf.length; i++) {
        const s = buf[i];
        if (!s || s.t < windowStart) continue;
        if (s.v < rangeMin) rangeMin = s.v;
        if (s.v > rangeMax) rangeMax = s.v;
      }
      if (!Number.isFinite(rangeMin)) rangeMin = valueRef.current;
      if (!Number.isFinite(rangeMax)) rangeMax = valueRef.current;

      const baselineT = now - TREND_LOOKBACK_MS;
      let baseline: Sample | null = null;
      for (let i = 0; i < buf.length; i++) {
        const s = buf[i];
        if (!s) continue;
        if (s.t >= baselineT) {
          baseline = s;
          break;
        }
      }
      const span = maxRef.current - minRef.current;
      const threshold = Math.max(2, span * 0.02);
      let trend = "steady";
      if (baseline) {
        const diff = valueRef.current - baseline.v;
        if (diff > threshold) trend = "rising";
        else if (diff < -threshold) trend = "falling";
      }
      return { roundedValue, rangeMin, rangeMax, trend };
    };

    const runAnnounce = (force: boolean) => {
      const now = performance.now();
      const summary = computeSummary(now);
      trendEl.textContent = summary.trend === "steady" ? "· steady" : `· ${summary.trend}`;
      rangeEl.textContent = `${formatWindowLabel(rangeMsRef.current)} ${formatDisplay(
        summary.rangeMin
      )}–${formatDisplay(summary.rangeMax)}`;
      if (cursorX >= 0) return; // an active scrub reading takes priority
      const changed =
        force ||
        Number.isNaN(lastAnnouncedRounded) ||
        Math.abs(summary.roundedValue - lastAnnouncedRounded) >=
          Math.max(2, (maxRef.current - minRef.current) * 0.03) ||
        summary.trend !== lastAnnouncedTrend;
      if (changed) {
        lastAnnouncedRounded = summary.roundedValue;
        lastAnnouncedTrend = summary.trend;
        status.textContent = `${labelRef.current}, currently ${formatDisplay(
          valueRef.current
        )}, ${summary.trend}, ${formatWindowLabel(
          rangeMsRef.current
        )} range ${formatDisplay(summary.rangeMin)}–${formatDisplay(
          summary.rangeMax
        )}`;
      }
    };

    const stepOnce = (now: number, dt: number) => {
      if (!reduced) {
        const target = valueRef.current;
        const accel = -SPRING_K * (penValue - target) - SPRING_C * penVel;
        penVel += accel * dt;
        penValue += penVel * dt;
      } else {
        penValue = valueRef.current;
        penVel = 0;
      }
      pushSample(now);
      draw(now);
      updateCarriage();
      if (cursorX >= 0) updateCursor(now);
      readout.textContent = formatDisplay(valueRef.current);
    };

    const rafLoop = (now: number) => {
      const dt = Math.min(0.05, last === 0 ? 1 / 60 : (now - last) / 1000);
      last = now;
      stepOnce(now, dt);
      if (!paused) raf = requestAnimationFrame(rafLoop);
    };

    const stopLoops = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      if (reducedInterval) clearInterval(reducedInterval);
      reducedInterval = undefined;
    };

    const startLoops = () => {
      stopLoops();
      if (paused) return;
      if (reduced) {
        stepOnce(performance.now(), 0);
        reducedInterval = setInterval(() => {
          stepOnce(performance.now(), 0);
        }, REDUCED_TICK_MS);
      } else {
        raf = requestAnimationFrame(rafLoop);
      }
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      draw(performance.now());
      updateCarriage();
      if (cursorX >= 0) {
        cursorX = Math.min(cursorX, plotWidth());
        updateCursor(performance.now());
      }
    };

    resize();
    startLoops();
    announceInterval = setInterval(() => runAnnounce(false), ANNOUNCE_INTERVAL_MS);
    runAnnounce(true);

    // -- pointer / keyboard scrub --------------------------------------------
    const onMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      cursorX = Math.max(0, Math.min(plotWidth(), e.clientX - rect.left));
      updateCursor(performance.now());
    };
    const onLeave = () => {
      if (cursorX < 0) return;
      cursorX = -1;
      root.setAttribute("aria-label", baseLabel);
      updateCursor(performance.now());
      runAnnounce(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      if (cursorX < 0) {
        cursorX = plotWidth();
      } else {
        const step = e.key === "ArrowLeft" ? -CURSOR_STEP_PX : CURSOR_STEP_PX;
        cursorX = Math.max(0, Math.min(plotWidth(), cursorX + step));
      }
      updateCursor(performance.now());
    };
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerdown", onMove);
    root.addEventListener("pointerleave", onLeave);
    root.addEventListener("keydown", onKey);
    root.addEventListener("blur", onLeave);

    const ro = new ResizeObserver(resize);
    ro.observe(root);

    const onThemeChange = () => {
      derive();
      draw(performance.now());
    };
    const mo = new MutationObserver(onThemeChange);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    colorScheme.addEventListener("change", onThemeChange);

    const reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onReducedChange = () => {
      reduced = reducedMq.matches;
      startLoops();
    };
    reducedMq.addEventListener("change", onReducedChange);

    const onVisibility = () => {
      paused = document.hidden;
      if (paused) stopLoops();
      else startLoops();
    };
    document.addEventListener("visibilitychange", onVisibility);

    let io: IntersectionObserver | undefined;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        paused = !entry.isIntersecting || document.hidden;
        if (paused) stopLoops();
        else startLoops();
      });
      io.observe(root);
    }

    return () => {
      stopLoops();
      if (announceInterval) clearInterval(announceInterval);
      ro.disconnect();
      mo.disconnect();
      colorScheme.removeEventListener("change", onThemeChange);
      reducedMq.removeEventListener("change", onReducedChange);
      document.removeEventListener("visibilitychange", onVisibility);
      io?.disconnect();
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerdown", onMove);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("keydown", onKey);
      root.removeEventListener("blur", onLeave);
    };
  }, []);

  return (
    <div className={`w-full select-none ${className}`}>
      <div className="mb-2 flex items-end justify-between gap-4 border-b border-border pb-2">
        <div className="flex items-baseline gap-2">
          <span
            aria-hidden
            className="motion-safe:animate-pulse inline-block h-1.5 w-1.5 rounded-full bg-foreground"
          />
          <span className="font-mono text-[11px] tracking-widest text-ns-muted">
            {label.toUpperCase()}
          </span>
        </div>
        <div className="flex items-baseline gap-3 font-mono">
          <span
            ref={readoutRef}
            className="text-2xl font-semibold tabular-nums text-foreground"
          >
            {formatValue ? formatValue(value) : `${Math.round(value)}${unit}`}
          </span>
          <span ref={trendRef} className="text-[11px] tabular-nums text-ns-muted" />
          <span
            ref={rangeRef}
            className="hidden text-[11px] tabular-nums text-ns-muted sm:inline"
          />
        </div>
      </div>
      <div
        ref={rootRef}
        role="img"
        aria-label={`${label} chart recorder strip`}
        tabIndex={0}
        style={{ touchAction: "pan-y", height: "calc(100% - 2.75rem)" }}
        className="relative w-full cursor-crosshair overflow-hidden rounded-md border border-border transition-colors duration-200 hover:border-foreground/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
      >
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
        <div
          ref={armRef}
          aria-hidden
          className="pointer-events-none absolute h-px origin-left bg-foreground/60"
          style={{ left: 0, top: 0, width: 0 }}
        />
        <div
          ref={carriageRef}
          aria-hidden
          className="pointer-events-none absolute h-2.5 w-2.5 rounded-full border-2 border-background bg-foreground"
          style={{ left: 0, top: 0 }}
        />
        <div
          ref={cursorLineRef}
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-px bg-ns-accent opacity-0"
          style={{ left: 0 }}
        />
        <div
          ref={cursorLabelRef}
          aria-hidden
          className="pointer-events-none absolute top-1 whitespace-nowrap rounded-sm border border-ns-accent/40 bg-background px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-ns-accent opacity-0"
          style={{ left: 0 }}
        />
      </div>
      <span ref={statusRef} role="status" aria-live="polite" className="sr-only" />
    </div>
  );
}
