"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

// ---------------------------------------------------------------------------
// WaveformAsciiScrub — an audio-style waveform rendered as columns of ASCII
// density glyphs, with a draggable playhead. The mechanic that sets this
// apart from every neighboring instrument: resolution is spatial and local,
// not a global hover-brighten. At rest the waveform renders at a fixed
// coarse column count (one glyph column per base sample). Dragging the
// playhead (or just hovering, or holding keyboard focus) subdivides the few
// base columns nearest the pointer into several finer sub-columns, each
// independently re-sampling the underlying (locally synthesised, no audio
// API) amplitude function at its own narrower time span — so the region
// under the cursor is re-inked at genuinely finer detail (more, thinner
// glyph columns revealing sub-peaks the coarse column averaged away) while
// the rest of the strip stays exactly as coarse as it was. The radius eases
// in/out over ~250ms rather than snapping.
//
// Distinct from voice-recorder-meter (real Web Audio analyser bars, one bin
// per bar, no drag/scrub, no resolution concept at all), scrubber-film-strip
// (a physical claw-and-perforation playback scrubber — its mechanic is
// slow-drag-snaps/fast-drag-glides, not spatial resolution), sparkline-ascii
// (a DOM character grid, fixed resolution throughout, no drag), and
// histogram-live-grain (distribution of arrivals, not a scrub position).
// ---------------------------------------------------------------------------

export interface WaveformAsciiScrubProps {
  /** Controlled scrub position, 0..1. Omit for uncontrolled (see defaultValue). */
  value?: number;
  /** Initial position, 0..1, when uncontrolled. Default 0.3. */
  defaultValue?: number;
  /** Total duration in seconds, used only to format aria-valuetext. Default 180. */
  duration?: number;
  /** called with the new position on every scrub */
  onValueChange?: (value: number) => void;
  /** accessible name for the scrubber */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const BASE_COLS = 64;
const SUBDIVIDE = 3;
const FOCUS_RADIUS_COLS = 6;
const MAX_ROWS = 7;
const CHARSET = " .:-=+*#%@";
const VIEW_W = 600;
const VIEW_H = 150;
const EASE_EPS = 0.02;

// Deterministic synthetic amplitude — layered sine partials plus a slow
// swell envelope, so a coarse sample averages away detail that a finer
// sample genuinely reveals. No audio API, no randomness.
function amplitude(t: number): number {
  const s = t * 40;
  let v = 0;
  v += 0.5 * Math.sin(s * 2.13 + 1.7);
  v += 0.3 * Math.sin(s * 5.02 + 0.4);
  v += 0.15 * Math.sin(s * 11.7 + 2.9);
  v += 0.1 * Math.sin(s * 23.3 + 5.1);
  const swell = 0.55 + 0.45 * Math.pow(Math.sin(t * Math.PI * 2 * 1.3 + 0.6), 2);
  return Math.min(1, Math.abs(v) * swell);
}

function peakIn(t0: number, t1: number): number {
  const SAMPLES = 6;
  let peak = 0;
  for (let s = 0; s < SAMPLES; s++) {
    const t = t0 + ((t1 - t0) * (s + 0.5)) / SAMPLES;
    peak = Math.max(peak, amplitude(t));
  }
  return peak;
}

function formatTime(frac: number, duration: number): string {
  const secs = Math.round(Math.max(0, Math.min(1, frac)) * duration);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface Tokens {
  fg: string;
  bg: string;
  muted: string;
  border: string;
  accent: string;
}

function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    fg: get("--foreground", "#171717"),
    bg: get("--background", "#ffffff"),
    muted: get("--ns-muted", "#4d4d4d"),
    border: get("--border", "#ebebeb"),
    accent: get("--ns-accent", "#006bff"),
  };
}

function useTokens(): Tokens {
  const [tokens, setTokens] = useState<Tokens>(() =>
    typeof document === "undefined"
      ? { fg: "#171717", bg: "#ffffff", muted: "#4d4d4d", border: "#ebebeb", accent: "#006bff" }
      : readTokens()
  );
  useEffect(() => {
    const sync = () => setTokens(readTokens());
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    return () => mo.disconnect();
  }, []);
  return tokens;
}

export function WaveformAsciiScrub({
  value,
  defaultValue = 0.3,
  duration = 180,
  onValueChange,
  label = "Scrub position",
  className = "",
}: WaveformAsciiScrubProps) {
  const uid = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tokens = useTokens();

  const isControlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue);
  const playhead = isControlled ? (value as number) : inner;

  const [dragging, setDragging] = useState(false);
  const [hoverFocus, setHoverFocus] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);

  const reducedRef = useRef(false);
  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  function commit(next: number) {
    const clamped = Math.max(0, Math.min(1, next));
    if (!isControlled) setInner(clamped);
    onValueChange?.(clamped);
  }

  function posFromClientX(clientX: number): number {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return playhead;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    commit(posFromClientX(e.clientX));
  }
  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const pos = posFromClientX(e.clientX);
    if (dragging) commit(pos);
    else setHoverFocus(pos);
  }
  function handlePointerUp() {
    setDragging(false);
  }
  function handlePointerLeave() {
    if (!dragging) setHoverFocus(null);
  }
  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    let next = playhead;
    if (e.key === "ArrowLeft") next -= 0.01;
    else if (e.key === "ArrowRight") next += 0.01;
    else if (e.key === "PageDown") next -= 0.05;
    else if (e.key === "PageUp") next += 0.05;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 1;
    else return;
    e.preventDefault();
    commit(next);
  }

  // priority: an active drag wins, then a hover preview, then keyboard focus
  // parked at the committed playhead — otherwise no local focus at all.
  const targetCenter = dragging ? playhead : hoverFocus !== null ? hoverFocus : focused ? playhead : null;

  const radiusRef = useRef(0);
  const centerRef = useRef(playhead);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = VIEW_W * dpr;
    canvas.height = VIEW_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const targetRadius = targetCenter === null ? 0 : FOCUS_RADIUS_COLS;
    if (targetCenter !== null) centerRef.current = targetCenter;

    const draw = () => {
      ctx.clearRect(0, 0, VIEW_W, VIEW_H);

      ctx.strokeStyle = tokens.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, VIEW_H / 2 + 0.5);
      ctx.lineTo(VIEW_W, VIEW_H / 2 + 0.5);
      ctx.stroke();

      const colW = VIEW_W / BASE_COLS;
      ctx.font = `${Math.max(8, colW * 0.95)}px "GeistMono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = tokens.fg;

      const rowH = (VIEW_H * 0.42) / MAX_ROWS;

      let x = 0;
      for (let i = 0; i < BASE_COLS; i++) {
        const t0 = i / BASE_COLS;
        const t1 = (i + 1) / BASE_COLS;
        const center = (i + 0.5) / BASE_COLS;
        const distCols = Math.abs(center - centerRef.current) * BASE_COLS;
        const subdivided = radiusRef.current > 0.5 && distCols < radiusRef.current;
        const parts = subdivided ? SUBDIVIDE : 1;
        const partW = colW / parts;

        for (let p = 0; p < parts; p++) {
          const pt0 = t0 + ((t1 - t0) * p) / parts;
          const pt1 = t0 + ((t1 - t0) * (p + 1)) / parts;
          const amp = peakIn(pt0, pt1);
          const rows = Math.max(1, Math.round(amp * MAX_ROWS));
          const glyphIdx = Math.min(CHARSET.length - 1, Math.floor(amp * (CHARSET.length - 1)));
          const glyph = CHARSET[glyphIdx];
          const cx = x + partW / 2;
          for (let r = 0; r < rows; r++) {
            const yy = VIEW_H / 2 - (r + 0.5) * rowH;
            ctx.fillText(glyph, cx, yy);
            ctx.fillText(glyph, cx, VIEW_H - yy);
          }
          x += partW;
        }
      }

      const px = playhead * VIEW_W;
      ctx.strokeStyle = tokens.accent;
      ctx.lineWidth = focused || dragging ? 2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(px + 0.5, 6);
      ctx.lineTo(px + 0.5, VIEW_H - 6);
      ctx.stroke();

      let animating = false;
      if (reducedRef.current) {
        radiusRef.current = targetRadius;
      } else {
        const dr = targetRadius - radiusRef.current;
        if (Math.abs(dr) > EASE_EPS) {
          radiusRef.current += dr * 0.25;
          animating = true;
        } else {
          radiusRef.current = targetRadius;
        }
      }

      if (animating) rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [tokens, playhead, targetCenter, focused, dragging]);

  return (
    <div className={`ns-was relative select-none ${className}`} style={{ width: VIEW_W, maxWidth: "100%" }}>
      <style>{CSS}</style>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ width: VIEW_W, height: VIEW_H, maxWidth: "100%", display: "block" }}
      />
      <div
        ref={wrapRef}
        id={`${uid}-slider`}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(playhead * 100)}
        aria-valuetext={formatTime(playhead, duration)}
        aria-orientation="horizontal"
        className="ns-was-hit absolute inset-0 cursor-pointer touch-none outline-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setDragging(false);
        }}
      />
    </div>
  );
}

const CSS = `
.ns-was-hit:focus-visible { outline: 2px solid var(--ns-accent); outline-offset: 2px; }
`;
