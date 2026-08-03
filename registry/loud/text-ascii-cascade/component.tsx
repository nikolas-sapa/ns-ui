"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// AsciiCascadeText — a showpiece where a headline collapses character by
// character into a scattered glyph field below it, then reassembles. This is
// a different axis of motion from text-decrypt (identity churns IN PLACE,
// positions never move) and from split-flap/counter-carry-ripple (a hinge or
// a 2-state vertical flip on a fixed grid): here every character is a free
// body that falls, drifts and fades into a field of noise glyphs, then climbs
// back to its exact slot with a staggered reassemble. The cycle runs
// ambiently forever at a slow, low-amplitude "breathe"; hovering immediately
// interrupts it with a full, high-amplitude cascade for as long as the
// pointer stays over it, so hover and rest are never the same frame. Pure
// direct-DOM rAF per character (translate3d + opacity on refs) — no React
// state on the hot path, monospace charset so no cell ever changes width.
// ---------------------------------------------------------------------------

const NOISE_CHARSET = "#%&@*+=-:.░▒▓";

type Phase = "settled" | "falling" | "field" | "reforming";

interface CharState {
  el: HTMLSpanElement | null;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  vy: number;
  dx: number; // per-character horizontal drift target while in the field
  opacity: number;
  glyph: string;
  target: string;
}

export interface AsciiCascadeTextProps {
  text: string;
  className?: string;
}

function pick(charset: string) {
  return charset[Math.floor(Math.random() * charset.length)] ?? "#";
}

export function AsciiCascadeText({ text, className = "" }: AsciiCascadeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const charsStateRef = useRef<CharState[]>([]);
  const [reduced, setReduced] = useState(false);
  const hoverRef = useRef(false);

  const glyphs = useMemo(() => Array.from(text), [text]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || reduced) return;

    const states = charsStateRef.current;

    const measureHomes = () => {
      const rect = container.getBoundingClientRect();
      for (const s of states) {
        if (!s.el) continue;
        const box = s.el.getBoundingClientRect();
        s.homeX = box.left - rect.left;
        s.homeY = box.top - rect.top;
        if (s.x === 0 && s.y === 0 && s.opacity === 1) {
          s.x = s.homeX;
          s.y = s.homeY;
        }
      }
    };
    measureHomes();

    let raf = 0;
    let last = 0;
    let phase: Phase = "settled";
    let phaseStart = performance.now();
    let visible = true;

    const FIELD_DROP = 46; // low-amplitude ambient fall, px
    const FIELD_DROP_HOVER = 96; // amplified fall while hovered

    const HOLD_MS = 2600;
    const FALL_MS = 620;
    const DWELL_MS = 520;
    const REFORM_MS = 720;

    const startFall = (now: number) => {
      phase = "falling";
      phaseStart = now;
      for (const s of states) {
        s.dx = (Math.random() - 0.5) * 18;
        s.vy = 0;
      }
    };

    const loop = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const hovering = hoverRef.current;
      const drop = hovering ? FIELD_DROP_HOVER : FIELD_DROP;
      const elapsed = now - phaseStart;

      if (phase === "settled" && elapsed > (hovering ? 0 : HOLD_MS)) {
        startFall(now);
      } else if (phase === "falling") {
        const p = Math.min(1, elapsed / FALL_MS);
        const eased = 1 - Math.pow(1 - p, 3);
        for (const s of states) {
          s.x = s.homeX + s.dx * eased;
          s.y = s.homeY + drop * eased;
          s.opacity = 1 - 0.72 * eased;
          if (Math.random() < 0.35) s.glyph = pick(NOISE_CHARSET);
        }
        if (p >= 1) {
          phase = "field";
          phaseStart = now;
        }
      } else if (phase === "field") {
        for (const s of states) {
          if (Math.random() < 0.18) s.glyph = pick(NOISE_CHARSET);
        }
        if (elapsed > (hovering ? DWELL_MS * 0.4 : DWELL_MS)) {
          phase = "reforming";
          phaseStart = now;
        }
      } else if (phase === "reforming") {
        const p = Math.min(1, elapsed / REFORM_MS);
        for (let i = 0; i < states.length; i++) {
          const s = states[i]!;
          const stagger = Math.min(0.35, i * 0.02);
          const local = Math.max(0, Math.min(1, (p - stagger) / (1 - stagger)));
          const eased = 1 - Math.pow(1 - local, 3);
          // lerp from the field's scattered offset back to the char's home slot
          s.x = s.homeX + s.dx * (1 - eased);
          s.y = s.homeY + drop * (1 - eased);
          s.opacity = 0.28 + 0.72 * eased;
          if (local < 1 && Math.random() < 0.25) s.glyph = pick(NOISE_CHARSET);
          else if (local >= 1) s.glyph = s.target;
        }
        if (p >= 1) {
          for (const s of states) {
            s.x = s.homeX;
            s.y = s.homeY;
            s.opacity = 1;
            s.glyph = s.target;
          }
          phase = "settled";
          phaseStart = now;
        }
      }

      for (const s of states) {
        if (!s.el) continue;
        s.el.style.transform = `translate3d(${(s.x - s.homeX).toFixed(2)}px, ${(s.y - s.homeY).toFixed(2)}px, 0)`;
        s.el.style.opacity = String(s.opacity);
        s.el.textContent = s.glyph;
        // the further a char has fallen from home, the more accent bleeds in —
        // a loud, colour-coded readout of "how far into the field" it is
        const strayed = Math.min(1, (1 - s.opacity) / 0.72);
        s.el.style.color = `color-mix(in oklab, var(--accent) ${Math.round(strayed * 70)}%, var(--foreground))`;
      }

      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(measureHomes);
    ro.observe(container);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
    });
    io.observe(container);
    const onVis = () => {
      if (!document.hidden && !raf) raf = requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", onVis);

    const onEnter = () => {
      hoverRef.current = true;
    };
    const onLeave = () => {
      hoverRef.current = false;
    };
    container.addEventListener("pointerenter", onEnter);
    container.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      container.removeEventListener("pointerenter", onEnter);
      container.removeEventListener("pointerleave", onLeave);
    };
  }, [glyphs, reduced]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-block whitespace-pre-wrap font-mono font-semibold text-foreground ${className}`}
    >
      <span aria-label={text} role="text">
        {glyphs.map((g, i) => (
          <span
            key={i}
            aria-hidden
            ref={(el) => {
              if (!charsStateRef.current[i]) {
                charsStateRef.current[i] = {
                  el: null,
                  homeX: 0,
                  homeY: 0,
                  x: 0,
                  y: 0,
                  vy: 0,
                  dx: 0,
                  opacity: 1,
                  glyph: g,
                  target: g,
                };
              }
              charsStateRef.current[i]!.el = el;
              charsStateRef.current[i]!.target = g;
            }}
            className="relative inline-block will-change-transform"
          >
            {g}
          </span>
        ))}
      </span>
    </div>
  );
}
