"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// KeymapAsciiHeat — an ASCII keyboard layout that accumulates real ink
// density per key as you type into a real text input: every keydown adds
// heat to that key's cell, heat decays on an exponential half-life so a key
// you stop pressing visibly fades back to blank paper, and the legend's
// scale is recomputed against whichever key is currently hottest. Distinct
// from shortcuts-cheat-sheet (a static keycap depresses itself for a listed
// COMBINATION and swallows the keydown — a rehearsal aid, no accumulation,
// no decay, no legend) and from heatmap-year-stipple (density via jittered
// dot count, not a character ramp, and driven by a canned yearly dataset,
// not live keystrokes). Density here is rendered as a big background glyph
// from a fixed ASCII ramp (" .:-=+*#%@"), never color or dot count, which
// is what keeps it visually its own thing next to both neighbors. No
// canvas: every glyph is a real DOM span, colored from --foreground via a
// Tailwind opacity utility, no hex.
// ---------------------------------------------------------------------------

const RAMP = [" ", ".", ":", "-", "=", "+", "*", "#", "%", "@"];
const HALF_LIFE_MS = 7000;
const REPAINT_MS = 90;
const SLEEP_EPS = 0.02;

const ROWS: string[][] = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
];

function decay(ink: number, dtMs: number): number {
  return ink * Math.pow(0.5, dtMs / HALF_LIFE_MS);
}

function keyFor(e: { key: string }): string | null {
  if (e.key === " ") return "SPACE";
  if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) return e.key.toUpperCase();
  return null;
}

export interface KeymapAsciiHeatProps {
  placeholder?: string;
  label?: string;
  className?: string;
}

export function KeymapAsciiHeat({
  placeholder = "Type here — the keys below heat up as you go",
  label = "Type to build heat",
  className = "",
}: KeymapAsciiHeatProps) {
  const inkRef = useRef(new Map<string, { ink: number; lastAt: number }>());
  const rafRef = useRef(0);
  const lastRepaintRef = useRef(0);
  const reducedRef = useRef(false);

  const [levels, setLevels] = useState<Record<string, number>>({});
  const [maxInk, setMaxInk] = useState(0);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reducedRef.current = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const recompute = (now: number) => {
    const raw: Record<string, number> = {};
    let max = 0;
    let anyLive = false;
    inkRef.current.forEach((v, key) => {
      const cur = decay(v.ink, now - v.lastAt);
      if (cur > SLEEP_EPS) anyLive = true;
      raw[key] = cur;
      if (cur > max) max = cur;
    });
    setLevels(raw);
    setMaxInk(max);
    return anyLive;
  };

  const stop = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  };

  const step = (now: number) => {
    rafRef.current = 0;
    if (now - lastRepaintRef.current >= REPAINT_MS) {
      lastRepaintRef.current = now;
      const anyLive = recompute(now);
      if (!anyLive) return; // sleep — pulse() wakes it again
    }
    rafRef.current = requestAnimationFrame(step);
  };

  const wake = () => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => stop, []);

  const pulse = (key: string) => {
    const now = performance.now();
    const m = inkRef.current;
    const prev = m.get(key);
    const cur = prev ? decay(prev.ink, now - prev.lastAt) : 0;
    m.set(key, { ink: cur + 1, lastAt: now });
    if (reducedRef.current) {
      lastRepaintRef.current = now;
      recompute(now);
    } else {
      wake();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const key = keyFor(e);
    if (key) pulse(key);
  };

  const glyphFor = (key: string): string => {
    const v = levels[key] ?? 0;
    if (maxInk <= SLEEP_EPS) return RAMP[0]!;
    const idx = Math.min(RAMP.length - 1, Math.round((v / maxInk) * (RAMP.length - 1)));
    return RAMP[idx]!;
  };

  const legend = useMemo(() => RAMP.join(""), []);

  const renderKey = (key: string, wide = false) => (
    <div
      key={key}
      aria-hidden
      data-key={key}
      onPointerEnter={() => setHoveredKey(key)}
      onPointerLeave={() => setHoveredKey((h) => (h === key ? null : h))}
      className={`relative flex h-9 items-center justify-center rounded-sm border border-border bg-background text-foreground transition-colors duration-100 motion-reduce:transition-none hover:bg-foreground/[0.06] ${
        wide ? "w-40" : "w-9"
      }`}
    >
      <span className="pointer-events-none absolute inset-0 flex select-none items-center justify-center text-lg leading-none text-foreground/70">
        {glyphFor(key)}
      </span>
      <span className="relative z-10 select-none text-[11px] font-semibold tracking-wide">
        {key === "SPACE" ? "␣" : key}
      </span>
    </div>
  );

  return (
    <div className={`inline-flex flex-col gap-3 font-mono ${className}`}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={label}
        className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors duration-100 motion-reduce:transition-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
      />

      <div className="flex flex-col items-center gap-1.5 rounded-sm border border-border bg-surface p-3">
        {ROWS.map((row, i) => (
          <div key={i} className="flex gap-1.5">
            {row.map((k) => renderKey(k))}
          </div>
        ))}
        <div className="flex gap-1.5 pt-0.5">{renderKey("SPACE", true)}</div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-sm border border-border bg-background px-3 py-1.5 text-[11px] text-muted">
        <span data-legend className="tabular-nums">
          ink {legend} max={maxInk.toFixed(1)}
        </span>
        <span data-hover-readout className="tabular-nums">
          {hoveredKey ? `${hoveredKey === "SPACE" ? "␣" : hoveredKey}: ${(levels[hoveredKey] ?? 0).toFixed(1)}` : "hover a key"}
        </span>
      </div>
    </div>
  );
}
