"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// SignetDrop — press-and-hold confirm rendered as a molten wax seal, not a
// progress bar. Holding the "Seal" button pours molten crimson wax onto a
// document line beneath: an SVG gooey filter (feGaussianBlur -> feColorMatrix
// alpha-threshold) fuses three growing circles into one liquid blob that
// wobbles on sin/cos jitter while it is still molten. Reaching the hold
// threshold triggers the signet: a stamp drops fast from above (ease-in),
// squash-and-rebounds on impact, presses the blob into a static scalloped
// seal disc with an embossed monogram (two offset copies faking a bevel) and
// a squish ring of displaced wax puffing outward, then retracts. The seal
// then COOLS for exactly 2s — the specular sheen dies, the fill interpolates
// from hot to deep crimson, and three hairline micro-cracks etch in on
// staggered stroke-dashoffset reveals measured in RAW SVG user units (no
// pathLength normalization, no vector-effect="non-scaling-stroke" — the two
// must never be combined). Early release before the threshold is the cancel
// path: the blob slumps, flattening against the line and draining away, and
// the button re-arms. Once sealed, state is terminal: the disc stays, the
// button dims under aria-disabled with its accessible name intact, and a
// visible "Sealed" caption appears — no reset, no replay.
//
// Hot path is refs + rAF only: hold progress, wobble jitter, stamp drop,
// puff ring, cooling color lerp and crack reveals are all direct
// setAttribute writes on SVG refs. React state carries only the discrete
// phase and the sr-only announcement text.
//
// Accessibility: the hold works from the keyboard (Space/Enter down starts,
// up before threshold cancels); a dedicated sr-only span
// (role=status/aria-live=polite/aria-atomic=true) announces "Poured",
// "Sealed" and "Cancelled", with a zero-width-space parity toggle so a
// repeated identical message (two cancels in a row) still re-announces.
// prefers-reduced-motion keeps the hold requirement (intent is preserved)
// but skips every intermediate visual — the moment progress reaches 1.0 the
// fully cooled, cracked seal appears in a single discrete step.
// ---------------------------------------------------------------------------

export type SignetDropPhase =
  | "idle"
  | "pouring"
  | "stamping"
  | "cooling"
  | "sealed"
  | "cancelling";

export interface SignetDropProps {
  /** Hold duration required to complete the seal, in ms. Default 1100. */
  holdMs?: number;
  /**
   * Self-driving mode for automated previews: runs a scripted timeline
   * through the same internal hold/release functions the real pointer and
   * keyboard handlers use — two short early-release holds (slump) in the
   * first seconds, then one full hold that seals permanently. Scripted steps
   * yield to any real interaction in progress.
   */
  demo?: boolean;
  /** Called once when the terminal sealed state is reached. */
  onSealed?: () => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

type HoldSource = "real" | "synthetic";

const HOLD_DEFAULT_MS = 1100;
const CANCEL_MS = 520;
const DROP_MS = 190;
const SQUASH_MS = 260;
const RETRACT_MS = 240;
const PUFF_MS = 380;
const COOL_MS = 2000;
const CRACK_STAGGER_MS = 420;
const CRACK_MS = 700;

// Stage geometry (SVG user units, viewBox 0 0 280 170).
const CX = 140;
const CY = 112;
const SEAL_R = 29;
const LINE_Y = 120;
const STAMP_ANCHOR_Y = 86;
const STAMP_RAISE = -92;

// Deep crimson wax — component-local by design; the repo has no crimson
// token and the loud collection is color-exempt. Chrome around the wax
// stays on the standard tokens.
const WAX_MOLTEN = "#b31b30";
const WAX_HOT = "#9c1526";
const WAX_COOL = "#570d18";
const WAX_HIGHLIGHT = "#d96475";
const WAX_SHADOW = "#33060d";

const GOO_BLOBS = [
  { x: 140, y: 110, r: 22 },
  { x: 127, y: 116, r: 14 },
  { x: 153, y: 115, r: 13 },
] as const;

const PUFF_COUNT = 8;
const PUFFS = Array.from({ length: PUFF_COUNT }, (_, i) => {
  const a = (i / PUFF_COUNT) * Math.PI * 2 + 0.35;
  return { cos: Math.cos(a), sin: Math.sin(a) };
});

// Scalloped seal perimeter: a circle whose radius is modulated by a
// low-frequency cosine — 10 scallops around the rim.
function scallopPath(
  cx: number,
  cy: number,
  r: number,
  scallops: number,
  amp: number
): string {
  const steps = 140;
  const parts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * Math.PI * 2;
    const rr = r + amp * Math.cos(th * scallops);
    parts.push(
      `${i === 0 ? "M" : "L"} ${(cx + rr * Math.cos(th)).toFixed(2)} ${(cy + rr * Math.sin(th)).toFixed(2)}`
    );
  }
  return parts.join(" ") + " Z";
}

const SEAL_PATH = scallopPath(CX, CY, SEAL_R, 10, 2.6);
const SEAL_RIM = scallopPath(CX, CY, SEAL_R - 4.5, 10, 1.6);

// Hairline micro-cracks, authored directly in raw user units inside the
// disc (center 140,112, r 29). Revealed via stroke-dasharray/dashoffset
// measured with getTotalLength() — never pathLength-normalized.
const CRACK_PATHS = [
  "M 120 102 l 9 4 l 6 -3 l 10 5 l 7 -2",
  "M 158 126 l -8 -3 l -5 4 l -9 -2",
  "M 133 92 l 4 7 l 6 2 l 3 6",
] as const;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const [HOT_R, HOT_G, HOT_B] = hexToRgb(WAX_HOT);
const [COOL_R, COOL_G, COOL_B] = hexToRgb(WAX_COOL);

function lerpWax(u: number): string {
  const r = Math.round(HOT_R + (COOL_R - HOT_R) * u);
  const g = Math.round(HOT_G + (COOL_G - HOT_G) * u);
  const b = Math.round(HOT_B + (COOL_B - HOT_B) * u);
  return `rgb(${r}, ${g}, ${b})`;
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInCubic = (t: number) => t * t * t;

// Squash-and-rebound: instant compression to `deep` at impact, overshoot to
// `over`, settle at 1.
function squashScale(u: number, deep: number, over: number): number {
  if (u >= 1) return 1;
  if (u < 0.5) return deep + (over - deep) * easeOutCubic(u / 0.5);
  return over + (1 - over) * easeOutCubic((u - 0.5) / 0.5);
}

const anchoredScale = (cx: number, cy: number, sx: number, sy: number) =>
  `translate(${cx} ${cy}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(${-cx} ${-cy})`;

export function SignetDrop({
  holdMs = HOLD_DEFAULT_MS,
  demo = false,
  onSealed,
  className = "",
}: SignetDropProps) {
  const rawId = useId();
  const gooId = `signet-goo-${rawId.replace(/:/g, "")}`;

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const gooGroupRef = useRef<SVGGElement | null>(null);
  const gooRefs = useRef<(SVGCircleElement | null)[]>([]);
  const sealGroupRef = useRef<SVGGElement | null>(null);
  const discRef = useRef<SVGPathElement | null>(null);
  const sheenRef = useRef<SVGEllipseElement | null>(null);
  const crackRefs = useRef<(SVGPathElement | null)[]>([]);
  const puffRefs = useRef<(SVGCircleElement | null)[]>([]);
  const stampOuterRef = useRef<SVGGElement | null>(null);
  const stampSquashRef = useRef<SVGGElement | null>(null);

  const [phase, setPhase] = useState<SignetDropPhase>("idle");
  const [announceText, setAnnounceText] = useState("");
  const parityRef = useRef(false);

  const holdMsRef = useRef(holdMs);
  holdMsRef.current = holdMs;
  const onSealedRef = useRef(onSealed);
  onSealedRef.current = onSealed;

  const stateRef = useRef({
    phase: "idle" as SignetDropPhase,
    holdSource: null as HoldSource | null,
    progress: 0,
    t: 0, // wobble clock (ms)
    last: 0,
    raf: 0,
    reduced: false,
    stampStart: 0,
    impactDone: false,
    coolStart: 0,
    cancelStart: 0,
    cancelP: 0,
    crackLens: [0, 0, 0] as number[],
  });

  const apiRef = useRef<{
    start: () => void;
    release: () => void;
  } | null>(null);

  const announce = useCallback((message: "Poured" | "Sealed" | "Cancelled") => {
    // Zero-width-space parity toggle: forces a real text-node change even
    // when the same message repeats (two "Cancelled" in a row), which is
    // what actually re-triggers an aria-live announcement.
    parityRef.current = !parityRef.current;
    setAnnounceText(message + (parityRef.current ? "​" : ""));
  }, []);

  useEffect(() => {
    const s = stateRef.current;
    const btn = btnRef.current;
    if (!btn) return;

    const setPhaseBoth = (p: SignetDropPhase) => {
      s.phase = p;
      setPhase(p);
    };

    const gooCircle = (i: number) => gooRefs.current[i] ?? null;

    const hideGoo = () => {
      const g = gooGroupRef.current;
      if (g) {
        g.setAttribute("opacity", "0");
        g.removeAttribute("transform");
      }
      GOO_BLOBS.forEach((b, i) => {
        const c = gooCircle(i);
        if (!c) return;
        c.setAttribute("r", "0");
        c.setAttribute("cx", String(b.x));
        c.setAttribute("cy", String(b.y));
      });
    };

    const hidePuffs = () => {
      for (const p of puffRefs.current) {
        if (p) p.setAttribute("opacity", "0");
      }
    };

    const writeGooFrame = (p: number) => {
      const grow = easeOutCubic(p);
      GOO_BLOBS.forEach((b, i) => {
        const c = gooCircle(i);
        if (!c) return;
        const wob = 2.4 * p;
        c.setAttribute("r", (b.r * grow).toFixed(2));
        c.setAttribute(
          "cx",
          (b.x + Math.sin(s.t * 0.006 + i * 2.1) * wob).toFixed(2)
        );
        c.setAttribute(
          "cy",
          (b.y + Math.cos(s.t * 0.0048 + i * 1.4) * wob * 0.7).toFixed(2)
        );
      });
    };

    const revealCracksFully = () => {
      crackRefs.current.forEach((c) => {
        if (c) c.setAttribute("stroke-dashoffset", "0");
      });
    };

    const finalizeSealed = () => {
      const disc = discRef.current;
      if (disc) disc.setAttribute("fill", WAX_COOL);
      if (sheenRef.current) sheenRef.current.setAttribute("opacity", "0");
      revealCracksFully();
      sealGroupRef.current?.removeAttribute("transform");
      hidePuffs();
      setPhaseBoth("sealed");
      announce("Sealed");
      onSealedRef.current?.();
    };

    // Reduced motion: the hold was still required, but every intermediate
    // visual is skipped — one discrete jump to the cooled, cracked seal.
    const sealInstant = () => {
      hideGoo();
      const stamp = stampOuterRef.current;
      if (stamp) stamp.setAttribute("opacity", "0");
      sealGroupRef.current?.setAttribute("opacity", "1");
      finalizeSealed();
    };

    const impact = () => {
      s.impactDone = true;
      hideGoo();
      sealGroupRef.current?.setAttribute("opacity", "1");
      discRef.current?.setAttribute("fill", WAX_HOT);
      sheenRef.current?.setAttribute("opacity", "0.4");
    };

    const beginStamp = (now: number) => {
      s.holdSource = null; // completion is committed; release can no longer cancel
      if (s.reduced) {
        sealInstant();
        return;
      }
      setPhaseBoth("stamping");
      s.stampStart = now;
      s.impactDone = false;
      stampOuterRef.current?.setAttribute("opacity", "1");
    };

    const tick = (now: number) => {
      // Clamped to 0: a rAF timestamp can read marginally behind the
      // performance.now() sample wake() took to seed s.last (first frame
      // after (re)starting the loop), which without the clamp drives
      // progress slightly negative and easeOutCubic negative in turn —
      // a negative wax-blob radius the browser rejects outright.
      const raw = Math.max(0, now - s.last); // wall time keeps the hold duration honest
      const dt = Math.min(64, raw); // clamped for the wobble clock
      s.last = now;
      s.t += dt;

      if (s.phase === "pouring") {
        s.progress = Math.min(1, s.progress + raw / holdMsRef.current);
        if (!s.reduced) writeGooFrame(s.progress);
        if (s.progress >= 1) beginStamp(now);
      } else if (s.phase === "cancelling") {
        const k = Math.min(1, (now - s.cancelStart) / CANCEL_MS);
        const sy = 1 - 0.85 * easeOutCubic(k);
        const sx = 1 + 0.3 * easeOutCubic(k);
        const g = gooGroupRef.current;
        if (g) {
          // Slump anchored at the document line: widen while flattening,
          // losing surface tension as it drains.
          g.setAttribute("transform", anchoredScale(CX, LINE_Y, sx, sy));
          g.setAttribute("opacity", (1 - easeInCubic(k)).toFixed(3));
        }
        const base = easeOutCubic(s.cancelP);
        GOO_BLOBS.forEach((b, i) => {
          const c = gooCircle(i);
          if (c) c.setAttribute("r", (b.r * base * (1 - 0.55 * k)).toFixed(2));
        });
        if (k >= 1) {
          hideGoo();
          setPhaseBoth("idle");
        }
      } else if (s.phase === "stamping") {
        const e = now - s.stampStart;
        const stamp = stampOuterRef.current;
        if (e < DROP_MS) {
          // Fast ease-in drop; the still-molten blob keeps wobbling beneath.
          const y = STAMP_RAISE * (1 - easeInCubic(e / DROP_MS));
          stamp?.setAttribute("transform", `translate(0 ${y.toFixed(2)})`);
          writeGooFrame(1);
        } else {
          if (!s.impactDone) impact();
          const u = Math.min(1, (e - DROP_MS) / SQUASH_MS);
          const stampSy = squashScale(u, 0.76, 1.05);
          const stampSx = 1 + (1 - stampSy) * 0.4;
          stampSquashRef.current?.setAttribute(
            "transform",
            anchoredScale(CX, STAMP_ANCHOR_Y, stampSx, stampSy)
          );
          stamp?.setAttribute("transform", "translate(0 0)");
          const discSy = squashScale(u, 0.84, 1.02);
          const discSx = 1 + (1 - discSy) * 0.5;
          sealGroupRef.current?.setAttribute(
            "transform",
            anchoredScale(CX, CY + SEAL_R, discSx, discSy)
          );
          // Squish ring: displaced wax puffs outward from the rim and fades.
          const pu = Math.min(1, (e - DROP_MS) / PUFF_MS);
          PUFFS.forEach((p, i) => {
            const c = puffRefs.current[i];
            if (!c) return;
            const d = SEAL_R + 17 * easeOutCubic(pu);
            c.setAttribute("cx", (CX + p.cos * d).toFixed(2));
            c.setAttribute("cy", (CY + p.sin * d * 0.8).toFixed(2));
            c.setAttribute("r", (3.4 * (1 - pu)).toFixed(2));
            c.setAttribute("opacity", (0.85 * (1 - pu)).toFixed(3));
          });
          if (e >= DROP_MS + SQUASH_MS) {
            const ru = Math.min(1, (e - DROP_MS - SQUASH_MS) / RETRACT_MS);
            stamp?.setAttribute(
              "transform",
              `translate(0 ${(STAMP_RAISE * easeOutCubic(ru)).toFixed(2)})`
            );
            stamp?.setAttribute("opacity", (1 - ru).toFixed(3));
            if (ru >= 1) {
              stamp?.setAttribute("opacity", "0");
              stampSquashRef.current?.removeAttribute("transform");
              sealGroupRef.current?.removeAttribute("transform");
              hidePuffs();
              setPhaseBoth("cooling");
              s.coolStart = now;
            }
          }
        }
      } else if (s.phase === "cooling") {
        const e = now - s.coolStart;
        const u = Math.min(1, e / COOL_MS);
        discRef.current?.setAttribute("fill", lerpWax(u));
        sheenRef.current?.setAttribute("opacity", (0.4 * (1 - u)).toFixed(3));
        crackRefs.current.forEach((c, i) => {
          if (!c) return;
          const L = s.crackLens[i] ?? 0;
          const lu = Math.min(
            1,
            Math.max(0, (e - i * CRACK_STAGGER_MS) / CRACK_MS)
          );
          c.setAttribute(
            "stroke-dashoffset",
            (L * (1 - easeOutCubic(lu))).toFixed(2)
          );
        });
        if (u >= 1) {
          finalizeSealed();
        }
      }

      if (
        s.phase === "pouring" ||
        s.phase === "cancelling" ||
        s.phase === "stamping" ||
        s.phase === "cooling"
      ) {
        s.raf = requestAnimationFrame(tick);
      } else {
        s.raf = 0;
      }
    };

    const wake = () => {
      if (s.raf) return;
      s.last = performance.now();
      s.raf = requestAnimationFrame(tick);
    };

    const startHold = (source: HoldSource) => {
      if (s.phase !== "idle" || s.holdSource !== null) return;
      s.holdSource = source;
      s.progress = 0;
      s.t = 0;
      setPhaseBoth("pouring");
      announce("Poured");
      if (!s.reduced) {
        const g = gooGroupRef.current;
        if (g) {
          g.setAttribute("opacity", "1");
          g.removeAttribute("transform");
        }
      }
      wake();
    };

    const release = (source: HoldSource) => {
      if (s.holdSource !== source) return;
      s.holdSource = null;
      if (s.phase !== "pouring") return;
      announce("Cancelled");
      if (s.reduced) {
        hideGoo();
        setPhaseBoth("idle");
        return;
      }
      s.cancelStart = performance.now();
      s.cancelP = s.progress;
      setPhaseBoth("cancelling");
      wake();
    };

    // Measure crack lengths once, in RAW user units (getTotalLength on the
    // authored geometry — no pathLength attribute anywhere), and park each
    // crack fully hidden behind its own dash offset.
    crackRefs.current.forEach((c, i) => {
      if (!c) return;
      const L = c.getTotalLength();
      s.crackLens[i] = L;
      c.setAttribute("stroke-dasharray", L.toFixed(2));
      c.setAttribute("stroke-dashoffset", L.toFixed(2));
    });

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => {
      s.reduced = mq.matches;
    };
    onMq();
    mq.addEventListener("change", onMq);

    const onPointerDown = (e: PointerEvent) => {
      if (s.phase === "sealed") return;
      btn.setPointerCapture(e.pointerId);
      startHold("real");
    };
    const onPointerEnd = () => release("real");
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) {
        e.preventDefault();
        if (s.phase === "sealed") return;
        startHold("real");
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") release("real");
    };
    const onBlur = () => release("real");

    btn.addEventListener("pointerdown", onPointerDown);
    btn.addEventListener("pointerup", onPointerEnd);
    btn.addEventListener("pointercancel", onPointerEnd);
    btn.addEventListener("pointerleave", onPointerEnd);
    btn.addEventListener("lostpointercapture", onPointerEnd);
    btn.addEventListener("keydown", onKeyDown);
    btn.addEventListener("keyup", onKeyUp);
    btn.addEventListener("blur", onBlur);

    // Scripted access for the self-driving demo — the exact same internal
    // hold/release functions the real handlers use. Synthetic starts no-op
    // while a real hold is active (startHold requires idle + no source) and
    // a synthetic release can never cancel a real hold (source mismatch).
    apiRef.current = {
      start: () => startHold("synthetic"),
      release: () => release("synthetic"),
    };

    return () => {
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      mq.removeEventListener("change", onMq);
      btn.removeEventListener("pointerdown", onPointerDown);
      btn.removeEventListener("pointerup", onPointerEnd);
      btn.removeEventListener("pointercancel", onPointerEnd);
      btn.removeEventListener("pointerleave", onPointerEnd);
      btn.removeEventListener("lostpointercapture", onPointerEnd);
      btn.removeEventListener("keydown", onKeyDown);
      btn.removeEventListener("keyup", onKeyUp);
      btn.removeEventListener("blur", onBlur);
      apiRef.current = null;
    };
  }, [announce]);

  // Demo timeline: two short holds that release early (slump) while the
  // automated gate screenshots a normal idle button, then one full hold
  // (~5.7s in) that completes, stamps, cools and stays sealed forever.
  useEffect(() => {
    if (!demo) return;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };
    at(900, () => apiRef.current?.start());
    at(1520, () => apiRef.current?.release());
    at(2800, () => apiRef.current?.start());
    at(3360, () => apiRef.current?.release());
    at(5700, () => apiRef.current?.start());
    at(5700 + holdMs + 250, () => apiRef.current?.release());
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [demo, holdMs]);

  const sealed = phase === "sealed";

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      {/* Dedicated announcer: only the throttle-free phase messages live
          here, never the button label. */}
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announceText}
      </span>

      <svg
        width={280}
        height={170}
        viewBox="0 0 280 170"
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none select-none"
      >
        <defs>
          {/* Classic goo: heavy blur, then an alpha threshold that fuses
              overlapping circles into one liquid silhouette. */}
          <filter id={gooId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
            />
          </filter>
        </defs>

        {/* Document edge: the tail of a letter, wax lands on the last rule. */}
        <line x1={18} y1={100} x2={96} y2={100} stroke="var(--border)" strokeWidth={2} />
        <line x1={18} y1={LINE_Y} x2={262} y2={LINE_Y} stroke="var(--border)" strokeWidth={2} />
        <line x1={18} y1={140} x2={110} y2={140} stroke="var(--border)" strokeWidth={2} />

        {/* Molten pour: gooey-fused circles, radii driven by hold progress,
            positions jittered by the wobble clock. */}
        <g ref={gooGroupRef} opacity={0} filter={`url(#${gooId})`}>
          {GOO_BLOBS.map((b, i) => (
            <circle
              key={i}
              ref={(el) => {
                gooRefs.current[i] = el;
              }}
              cx={b.x}
              cy={b.y}
              r={0}
              fill={WAX_MOLTEN}
            />
          ))}
        </g>

        {/* Squish ring: displaced wax at the moment of impact. */}
        <g>
          {PUFFS.map((_, i) => (
            <circle
              key={i}
              ref={(el) => {
                puffRefs.current[i] = el;
              }}
              cx={CX}
              cy={CY}
              r={0}
              fill={WAX_MOLTEN}
              opacity={0}
            />
          ))}
        </g>

        {/* The pressed seal: scalloped disc, embossed monogram, sheen,
            micro-cracks. Hidden until the stamp lands. */}
        <g ref={sealGroupRef} opacity={0}>
          <path ref={discRef} d={SEAL_PATH} fill={WAX_HOT} />
          <path
            d={SEAL_RIM}
            fill="none"
            stroke={WAX_SHADOW}
            strokeOpacity={0.4}
            strokeWidth={1}
          />
          <circle
            cx={CX}
            cy={CY}
            r={20}
            fill="none"
            stroke={WAX_HIGHLIGHT}
            strokeOpacity={0.28}
            strokeWidth={1}
          />
          {/* Emboss: two offset copies — dark shadow down-right, light
              highlight up-left — faking a bevel-carved monogram. */}
          <text
            x={CX + 0.9}
            y={CY + 0.9}
            textAnchor="middle"
            dominantBaseline="central"
            className="font-mono"
            fontSize={24}
            fontWeight={700}
            fill={WAX_SHADOW}
          >
            S
          </text>
          <text
            x={CX - 0.9}
            y={CY - 0.9}
            textAnchor="middle"
            dominantBaseline="central"
            className="font-mono"
            fontSize={24}
            fontWeight={700}
            fill={WAX_HIGHLIGHT}
            fillOpacity={0.9}
          >
            S
          </text>
          {/* Hairline micro-cracks — raw-unit dash reveals, staggered. */}
          {CRACK_PATHS.map((d, i) => (
            <path
              key={i}
              ref={(el) => {
                crackRefs.current[i] = el;
              }}
              d={d}
              fill="none"
              stroke={WAX_SHADOW}
              strokeOpacity={0.85}
              strokeWidth={0.9}
              strokeLinecap="round"
            />
          ))}
          {/* Specular sheen — dies as the wax cools. */}
          <ellipse
            ref={sheenRef}
            cx={130}
            cy={102}
            rx={9.5}
            ry={4.5}
            transform="rotate(-28 130 102)"
            fill="#ffffff"
            opacity={0}
          />
        </g>

        {/* The signet stamp: parked above the stage, drops on completion. */}
        <g ref={stampOuterRef} opacity={0} transform={`translate(0 ${STAMP_RAISE})`}>
          <g ref={stampSquashRef}>
            <rect
              x={133}
              y={40}
              width={14}
              height={38}
              rx={6}
              fill="var(--surface)"
              stroke="var(--ns-muted)"
              strokeWidth={1.3}
            />
            <rect
              x={116}
              y={74}
              width={48}
              height={12}
              rx={6}
              fill="var(--surface)"
              stroke="var(--ns-muted)"
              strokeWidth={1.3}
            />
            <line x1={124} y1={80} x2={156} y2={80} stroke="var(--border)" strokeWidth={1} />
          </g>
        </g>
      </svg>

      <div className="flex h-9 items-center gap-3">
        <button
          ref={btnRef}
          type="button"
          aria-disabled={sealed ? true : undefined}
          className="select-none touch-none rounded-[6px] border border-border bg-surface px-5 py-2 text-sm font-medium text-foreground transition-[background-color,border-color,transform] duration-150 hover:border-ns-muted hover:bg-border/60 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent aria-disabled:cursor-default aria-disabled:opacity-45 aria-disabled:hover:border-border aria-disabled:hover:bg-surface"
        >
          Seal
        </button>
        {sealed && (
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ns-muted">
            Sealed
          </span>
        )}
      </div>
    </div>
  );
}
