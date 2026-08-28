"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// CrimpBarrelSet — a "connect/link/attach" confirm control modeled on
// open-barrel wire crimping (MIL-STD-1130 / Molex application-spec
// geometry), not a button that swaps an icon or shows a checkmark. Two dies
// close on a barrel holding two conductor ends and flatten it into a
// stepped, witness-marked profile — a good crimp is judged by that
// witness-mark shape (a double-dimple die-tooth pair) and the slight
// "brush" flare of strand material at each mouth that wasn't fully
// captured, not just "did it close."
//
// The whole thing runs as an unforced, repeating demonstration cycle so it
// is alive at rest with zero input (Filter 2): sit open/idle (1.28s), dies
// close (220ms), hold seated (1.4s), retract (700ms), repeat — 3.6s total.
// (Idle sits FIRST in the ambient loop, not last — see the IDLE_MS note
// below for why: it's the only ordering under which t0/t2.5s/t5s land in
// three actually-distinct phases the way the spec's own worked example
// describes.) Hover/focus pre-stages the dies to a slightly gripping,
// non-witness-marked position as an affordance; pressing fires ONE full
// crimp cycle on its own independent clock (skipping idle, straight into
// close), then the ambient loop resumes from a fresh idle.
// A single scalar, closeAmt (0 open .. 1 seated), drives the barrel height,
// its witness-dimple geometry AND the die translateY together every frame,
// so the three can never drift out of sync with each other.
//
// Every colour is read once via getComputedStyle(document.documentElement)
// before any paint, and re-read on every class-attribute mutation of <html>
// (a MutationObserver) for live theme toggles — no literal colour anywhere.
// The witness-dimple mark is never a literal shade or a --background swap:
// it is the barrel's own live --foreground colour darkened by a fixed
// multiplier, computed the same way in both themes, because an indent under
// implied top-lighting reads darker than its surrounding surface regardless
// of which theme's foreground/background pair happens to be light or dark —
// swapping to --background directly would read as a LIGHT notch in light
// theme (foreground is the dark ink there), which is the exact defect this
// spec calls out. --ns-accent never touches the seated barrel or dimples —
// the crimped-shut state reads in luminance/geometry only; accent is
// confined to the button's own focus ring.
// ---------------------------------------------------------------------------

const CLOSE_MS = 220; // die travel, open -> seated
const HOLD_MS = 1400; // seated hold
const RETRACT_MS = 700; // dies retract, barrel springs back open
// NOTE: the spec's own literal numbers (220/1400/700 close+hold+retract,
// 2280 idle, 4600 total, idle LAST before the loop repeats) are mutually
// unsatisfiable against its own three named sample frames — hold ends at
// 1620ms into every cycle, and no cycle can be shorter than 2320ms (the
// close+hold+retract minimum), so a hold window can never land on t=2.5s
// for ANY idle duration under that ordering (proved by exhausting the
// offset/period search). Reordering to idle-FIRST and shortening idle to
// 1280ms (cadence 3.6s total) is the smallest change that keeps close/
// hold/retract at their real, sourced values while actually landing t0 in
// idle, t2.5s in hold-seated and t5s in a fresh cycle's mid-close, per the
// spec's own worked example.
const IDLE_MS = 1280; // open, idle, before the next cycle
const CYCLE_MS = IDLE_MS + CLOSE_MS + HOLD_MS + RETRACT_MS; // 3600

const GRIP_CLOSE_AMT = 0.18; // hover pre-stage: barrel slightly ovalized only

// SVG logical geometry (viewBox units) — fixed per the spec's own numbers,
// scaled to fit whatever box the <svg> is placed in via its viewBox.
const VBW = 200;
const VBH = 90;
const CY = VBH / 2;
const BW = 120; // barrel width, constant
const BX = (VBW - BW) / 2;
const H_OPEN = 36;
const H_SEATED = 22; // 62% of 36, per spec
const DIE_W = 34;
const DIE_H = 9;
const DIMPLE_HW = 3; // 6px-wide dimple
const DIMPLE_DEPTH = 4;
const STRAND_BASE_Y = [-5, 0, 5];
const STRAND_MAX_FLARE = [5, 2, 5]; // px, "2-5px" per spec
const STRAND_DIR = [-1, 1, 1];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function easeOutCubic(p: number): number {
  const q = 1 - p;
  return 1 - q * q * q;
}

// underdamped step response — zeta=0.7, ~120ms settle — drives the strand
// flare's overshoot-and-settle spring-back rather than stopping dead.
function springStep(tMs: number, settleMs = 120, zeta = 0.7): number {
  if (tMs <= 0) return 0;
  const t = tMs / 1000;
  const settle = settleMs / 1000;
  const wn = 4 / (zeta * settle);
  const wd = wn * Math.sqrt(Math.max(1e-6, 1 - zeta * zeta));
  return (
    1 -
    Math.exp(-zeta * wn * t) *
      (Math.cos(wd * t) + ((zeta * wn) / wd) * Math.sin(wd * t))
  );
}

interface CrimpFrame {
  closeAmt: number;
  dimpleAmt: number;
  flareFrac: number;
}

// One clock, one function: closeAmt (0 open .. 1 seated) is the sole driver
// of barrel height + dimple geometry + die position; dimpleAmt only rises
// in the final ~17% of the close (the "dies bottom out" window) and fades
// symmetrically on retract; flareFrac follows the real spring on the way in
// and rides closeAmt back down on the way out.
function crimpFrameAt(t: number): CrimpFrame {
  if (t < CLOSE_MS) {
    const closeAmt = easeOutCubic(t / CLOSE_MS);
    return {
      closeAmt,
      dimpleAmt: clamp01((closeAmt - 0.83) / 0.17),
      flareFrac: clamp01(springStep(t)),
    };
  }
  if (t < CLOSE_MS + HOLD_MS) {
    return { closeAmt: 1, dimpleAmt: 1, flareFrac: 1 };
  }
  const retractStart = CLOSE_MS + HOLD_MS;
  if (t < retractStart + RETRACT_MS) {
    const p = (t - retractStart) / RETRACT_MS;
    const closeAmt = 1 - easeOutCubic(p);
    return {
      closeAmt,
      dimpleAmt: clamp01((closeAmt - 0.83) / 0.17),
      flareFrac: closeAmt,
    };
  }
  return { closeAmt: 0, dimpleAmt: 0, flareFrac: 0 };
}

// ambient-loop framing: idle FIRST (barrel open, resting), then the same
// close/hold/retract mechanics above, shifted by IDLE_MS. A press skips
// straight into crimpFrameAt(0) instead — it never waits through idle.
function ambientFrameAt(t: number): CrimpFrame {
  if (t < IDLE_MS) return { closeAmt: 0, dimpleAmt: 0, flareFrac: 0 };
  return crimpFrameAt(t - IDLE_MS);
}

// stadium barrel outline with two pinch "witness dimple" notches on the top
// AND bottom edge at the same two fixed x-offsets — the double-dimple
// witness shape a real B-crimp die leaves, not a uniform squeeze.
function buildBarrelPath(h: number, dimpleAmt: number): string {
  const r = h / 2;
  const top = CY - h / 2;
  const bottom = CY + h / 2;
  const d1 = BX + BW * 0.3;
  const d2 = BX + BW * 0.7;
  const depth = DIMPLE_DEPTH * dimpleAmt;
  const leftCapX = BX + r;
  const rightCapX = BX + BW - r;

  const topPts: [number, number][] = [
    [leftCapX, top],
    [d1 - DIMPLE_HW, top],
    [d1, top + depth],
    [d1 + DIMPLE_HW, top],
    [d2 - DIMPLE_HW, top],
    [d2, top + depth],
    [d2 + DIMPLE_HW, top],
    [rightCapX, top],
  ];
  const bottomPts: [number, number][] = [
    [d2 + DIMPLE_HW, bottom],
    [d2, bottom - depth],
    [d2 - DIMPLE_HW, bottom],
    [d1 + DIMPLE_HW, bottom],
    [d1, bottom - depth],
    [d1 - DIMPLE_HW, bottom],
    [leftCapX, bottom],
  ];

  const f = (n: number) => n.toFixed(2);
  const topStr = topPts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${f(x)} ${f(y)}`)
    .join(" ");
  const bottomStr = bottomPts.map(([x, y]) => `L${f(x)} ${f(y)}`).join(" ");

  return `${topStr} A${f(r)} ${f(r)} 0 0 1 ${f(rightCapX)} ${f(bottom)} ${bottomStr} A${f(r)} ${f(r)} 0 0 1 ${f(leftCapX)} ${f(top)} Z`;
}

type Rgb = [number, number, number];

function parseColor(input: string): Rgb {
  const trimmed = input.trim();
  const fn = trimmed.match(/rgba?\(([^)]+)\)/i);
  if (fn) {
    const parts = fn[1]!.split(",").map((s) => parseFloat(s.trim()));
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  }
  const hex = trimmed.replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const num = parseInt(full || "808080", 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbStr([r, g, b]: Rgb, alpha = 1): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// darker than the barrel's own live fill, by a fixed factor, in EITHER
// theme — this is what keeps the witness dimple reading as an indent under
// implied top-lighting instead of flipping to a light notch in light theme.
function darken([r, g, b]: Rgb, factor = 0.45): Rgb {
  return [Math.round(r * factor), Math.round(g * factor), Math.round(b * factor)];
}

export interface CrimpBarrelSetProps {
  /** visible + accessible label on the control. default "Connect". */
  label?: string;
  /** announced once a user-triggered crimp reaches the seated, witness-marked state. default "Connected". */
  doneLabel?: string;
  /** called once per press, at the moment that press's crimp seats. */
  onConnect?: () => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function CrimpBarrelSet({
  label = "Connect",
  doneLabel = "Connected",
  onConnect,
  className = "",
}: CrimpBarrelSetProps) {
  const barrelRef = useRef<SVGPathElement>(null);
  const witness1Ref = useRef<SVGPathElement>(null);
  const witness2Ref = useRef<SVGPathElement>(null);
  const topDieRef = useRef<SVGRectElement>(null);
  const bottomDieRef = useRef<SVGRectElement>(null);
  const strandRefs = useRef<(SVGLineElement | null)[]>([]);

  const fgRgb = useRef<Rgb>([0, 0, 0]);
  const hoveringRef = useRef(false);
  const triggerPressRef = useRef<() => void>(() => {});
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    const barrel = barrelRef.current;
    const topDie = topDieRef.current;
    const bottomDie = bottomDieRef.current;
    if (!barrel || !topDie || !bottomDie) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      fgRgb.current = parseColor(cs.getPropertyValue("--foreground") || "#000000");
    };

    // no paint before the first token read
    readTokens();

    // die translateY range, derived once from the fixed geometry constants
    const openR = H_OPEN / 2;
    const seatedR = H_SEATED / 2;
    const topDieBaseY = CY - openR - 16 - DIE_H;
    const topDieSeatedY = CY - seatedR - DIE_H;
    const topDieTravel = topDieSeatedY - topDieBaseY;
    const bottomDieBaseY = CY + openR + 16;
    const bottomDieSeatedY = CY + seatedR;
    const bottomDieTravel = bottomDieSeatedY - bottomDieBaseY;

    const paint = ({ closeAmt, dimpleAmt, flareFrac }: CrimpFrame) => {
      const h = lerp(H_OPEN, H_SEATED, closeAmt);
      barrel.setAttribute("d", buildBarrelPath(h, dimpleAmt));
      barrel.style.fill = rgbStr(fgRgb.current, 0.94);

      const r = h / 2;
      const top = CY - h / 2;
      const bottom = CY + h / 2;
      const depth = DIMPLE_DEPTH * dimpleAmt;
      const d1 = BX + BW * 0.3;
      const d2 = BX + BW * 0.7;
      const notchColor = rgbStr(darken(fgRgb.current));
      if (witness1Ref.current) {
        witness1Ref.current.setAttribute(
          "d",
          `M${d1.toFixed(2)} ${(top + depth).toFixed(2)} L${d1.toFixed(2)} ${(bottom - depth).toFixed(2)}`
        );
        witness1Ref.current.style.stroke = notchColor;
        witness1Ref.current.style.opacity = dimpleAmt.toFixed(3);
      }
      if (witness2Ref.current) {
        witness2Ref.current.setAttribute(
          "d",
          `M${d2.toFixed(2)} ${(top + depth).toFixed(2)} L${d2.toFixed(2)} ${(bottom - depth).toFixed(2)}`
        );
        witness2Ref.current.style.stroke = notchColor;
        witness2Ref.current.style.opacity = dimpleAmt.toFixed(3);
      }

      topDie.style.transform = `translateY(${(topDieTravel * closeAmt).toFixed(2)}px)`;
      bottomDie.style.transform = `translateY(${(bottomDieTravel * closeAmt).toFixed(2)}px)`;
      topDie.style.fill = rgbStr(fgRgb.current, 0.94);
      bottomDie.style.fill = rgbStr(fgRgb.current, 0.94);

      const mouthL = BX + r;
      const mouthR = BX + BW - r;
      for (let side = 0; side < 2; side++) {
        const mouthX = side === 0 ? mouthL : mouthR;
        const outward = side === 0 ? -14 : 14;
        for (let i = 0; i < 3; i++) {
          const idx = side * 3 + i;
          const line = strandRefs.current[idx];
          if (!line) continue;
          const baseY = CY + STRAND_BASE_Y[i]!;
          const flareY =
            CY + STRAND_BASE_Y[i]! + STRAND_DIR[i]! * STRAND_MAX_FLARE[i]! * flareFrac;
          line.setAttribute("x1", (mouthX + outward).toFixed(2));
          line.setAttribute("y1", baseY.toFixed(2));
          line.setAttribute("x2", mouthX.toFixed(2));
          line.setAttribute("y2", flareY.toFixed(2));
          line.style.stroke = rgbStr(fgRgb.current, 0.85);
        }
      }
    };

    if (reduced) {
      // STATIC_PHASE = "seated" — the frame that actually explains the
      // mechanic, not t0's bare open barrel. Still a functioning control:
      // a press just fires the callback directly, no motion to play.
      paint(crimpFrameAt(CLOSE_MS));
      triggerPressRef.current = () => {
        onConnect?.();
        setAnnounce(doneLabel);
      };
      const mo = new MutationObserver(() => {
        readTokens();
        paint(crimpFrameAt(CLOSE_MS));
      });
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => mo.disconnect();
    }

    let raf = 0;
    let ambientStart = 0;
    let pressStart: number | null = null;
    let seatedFired = false;
    let visible = true;

    const loop = (now: number) => {
      if (ambientStart === 0) ambientStart = now;

      if (pressStart !== null) {
        const tLocal = now - pressStart;
        const pressTotal = CLOSE_MS + HOLD_MS + RETRACT_MS;
        if (tLocal >= pressTotal) {
          pressStart = null;
          ambientStart = now; // ambient loop resumes fresh, from open
          paint(crimpFrameAt(0));
        } else {
          const frame = crimpFrameAt(tLocal);
          paint(frame);
          if (frame.dimpleAmt >= 1 && !seatedFired) {
            seatedFired = true;
            onConnect?.();
            setAnnounce(doneLabel);
          }
        }
      } else {
        const t = (now - ambientStart) % CYCLE_MS;
        const frame = ambientFrameAt(t);
        if (hoveringRef.current) {
          frame.closeAmt = Math.max(frame.closeAmt, GRIP_CLOSE_AMT);
        }
        paint(frame);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    triggerPressRef.current = () => {
      pressStart = performance.now();
      seatedFired = false;
    };

    const mo = new MutationObserver(readTokens);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !raf) {
        raf = requestAnimationFrame(loop);
      } else if (!visible && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(barrel.ownerSVGElement ?? barrel);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      mo.disconnect();
      io.disconnect();
    };
  }, [doneLabel, onConnect]);

  return (
    <span className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <button
        type="button"
        aria-label={label}
        onMouseEnter={() => {
          hoveringRef.current = true;
        }}
        onMouseLeave={() => {
          hoveringRef.current = false;
        }}
        onFocus={() => {
          hoveringRef.current = true;
        }}
        onBlur={() => {
          hoveringRef.current = false;
        }}
        onClick={() => {
          triggerPressRef.current();
        }}
        className="rounded-lg border border-border bg-surface px-3 py-2 transition-colors duration-150 hover:border-foreground/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
      >
        <svg
          viewBox={`0 0 ${VBW} ${VBH}`}
          width="220"
          height="99"
          aria-hidden="true"
          focusable="false"
          className="block overflow-visible"
        >
          {/* static insulation stubs */}
          <line
            x1={BX - 40}
            y1={CY}
            x2={BX + H_OPEN / 2 - 14}
            y2={CY}
            className="stroke-ns-muted"
            strokeWidth={5}
            strokeLinecap="round"
          />
          <line
            x1={BX + BW - H_OPEN / 2 + 14}
            y1={CY}
            x2={BX + BW + 40}
            y2={CY}
            className="stroke-ns-muted"
            strokeWidth={5}
            strokeLinecap="round"
          />
          {/* strand flare lines, left then right, 3 each */}
          {Array.from({ length: 6 }, (_, i) => (
            <line
              key={i}
              ref={(el) => {
                strandRefs.current[i] = el;
              }}
              strokeWidth={1.4}
              strokeLinecap="round"
            />
          ))}
          {/* barrel */}
          <path ref={barrelRef} />
          {/* witness dimple marks */}
          <path ref={witness1Ref} strokeWidth={1.4} fill="none" />
          <path ref={witness2Ref} strokeWidth={1.4} fill="none" />
          {/* dies */}
          <rect
            ref={topDieRef}
            x={BX + BW / 2 - DIE_W / 2}
            y={CY - H_OPEN / 2 - 16 - DIE_H}
            width={DIE_W}
            height={DIE_H}
            rx={1.5}
          />
          <rect
            ref={bottomDieRef}
            x={BX + BW / 2 - DIE_W / 2}
            y={CY + H_OPEN / 2 + 16}
            width={DIE_W}
            height={DIE_H}
            rx={1.5}
          />
        </svg>
      </button>
      <span className="text-sm text-foreground">{label}</span>
      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </span>
  );
}
