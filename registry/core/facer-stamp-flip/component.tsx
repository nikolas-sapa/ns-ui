"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// FacerStampFlip — a batch-processing loader (no total count, only continuous
// throughput) built as a letter-facing and cancelling machine's orientation
// stage. Mixed-orientation letters feed in a single-file stream; a fixed
// gate line stands in for the optical sensor bank that reads each envelope's
// stamp-corner position, and any envelope not already stamp-corner-up-right
// rotates into that common orientation as it crosses the line before
// continuing on. A brief ink tap follows as a secondary consequence — the
// canceller's franking-meter and hand-stamp moments already belong to
// `frank-register` and `not-found-postmark`, so the cancel mark here stays a
// small, functional tick, never the climax.
//
// Real throughput on a facer-canceller runs ~30,000 letters/hour (~8.3/s) —
// far above anything that reads as discrete motion on a 60Hz screen, so the
// rendered feed is deliberately decoupled: one envelope spawns every 1.1s.
// Each spawns with a rotation drawn from a FIXED period-4 sequence (0, 180,
// 90, 270deg, never Math.random()), so exactly 1-in-4 envelopes is already
// correctly oriented and passes the gate as a visible no-op rather than
// getting flipped — the no-op case is what makes the flip read as a
// decision, not a tic, so it gets its own fainter gate-flash beat rather
// than being invisible.
//
// One shared rAF loop drives every envelope's lane position (a plain JS
// translateX mutation, no CSS animation timeline); rotation itself is a CSS
// transform on a nested element so the browser's own 340ms transition can
// own the flip motion independently of the per-frame position write. All
// geometry derives from the container's smaller dimension so this reads at
// card scale in a wide short slot exactly as well as a narrow tall one.
// ---------------------------------------------------------------------------

const ENV_HEIGHT_RATIO = 0.22; // envelope height = 0.22 * min(container w, h)
const ENV_ASPECT = 1.7; // width = height * ENV_ASPECT — a personal-envelope proportion
const SPAWN_INTERVAL_MS = 1100; // rendered feed rate — real rate (~8.3/s) is documented, not animated
const TRAVERSE_MS = 3300; // time for one envelope to cross the full lane, off-left to off-right
const GATE_FRACTION = 0.55; // fixed gate x-position, fraction of lane width
const ROTATION_SEQUENCE = [0, 180, 90, 270]; // fixed period-4 spawn sequence
const FLIP_MS = 340; // facing-gate rotate-to-0deg transition
const GATE_FLASH_MS = 120; // gate-line brightness flash decay, both flip and no-op cases
const CANCEL_DELAY_MS = 90; // after reaching 0deg, before the ink mark appears
const CANCEL_HOLD_MS = 400; // ink mark visible at full opacity
const CANCEL_FADE_MS = 160; // ink mark fade-out
const PRESEED_PROGRESS = [0.75, 0.42, 0.25, 0.05]; // t0 lane occupancy, oldest (most-progressed) first

interface EnvelopeHandle {
  spawnAt: number; // ms on the internal clock; negative/large-progress for pre-seeded envelopes
  rotation: number;
  gated: boolean;
  posEl: HTMLDivElement;
  rotEl: HTMLDivElement;
  inkEl: HTMLDivElement;
  timers: number[];
}

export interface FacerStampFlipProps {
  /** accessible label for the ambient batch-processing status */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function FacerStampFlip({ label = "Normalizing files", className = "" }: FacerStampFlipProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const laneRef = useRef<HTMLDivElement>(null);
  const gateRef = useRef<HTMLDivElement>(null);
  const [smaller, setSmaller] = useState(0);
  const [laneWidth, setLaneWidth] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSmaller(Math.min(width, height));
      setLaneWidth(width);
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  const envH = smaller > 0 ? smaller * ENV_HEIGHT_RATIO : 0;
  const envW = envH * ENV_ASPECT;

  useEffect(() => {
    const lane = laneRef.current;
    const gate = gateRef.current;
    if (!lane || !gate || envH <= 0 || laneWidth <= 0) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gateX = GATE_FRACTION * laneWidth;

    // -- build one envelope: outer posEl carries the per-frame lane-position
    // transform (plain JS mutation), inner rotEl carries the rotation
    // transform (a CSS transition owns the flip), stamp corner + ink mark
    // live inside rotEl so both rotate together as a single rigid body. ----
    const makeEnvelope = (rotation: number) => {
      const posEl = document.createElement("div");
      posEl.style.position = "absolute";
      posEl.style.top = "50%";
      posEl.style.width = `${envW}px`;
      posEl.style.height = `${envH}px`;
      posEl.style.marginTop = `${-envH / 2}px`;
      posEl.style.left = "0px";
      posEl.style.willChange = "transform";

      const rotEl = document.createElement("div");
      rotEl.style.position = "relative";
      rotEl.style.width = "100%";
      rotEl.style.height = "100%";
      rotEl.style.transform = `rotate(${rotation}deg)`;
      rotEl.style.transformOrigin = "50% 50%";

      // three real luminance tiers against --background, none of them
      // --border (that token is reserved for the gate line at rest): a
      // raised 25% fill so the envelope itself is legible as the primary
      // subject, a 45% edge that does the shape-defining work, and an 82%
      // stamp corner clearly separated from both.
      const body = document.createElement("div");
      body.style.position = "absolute";
      body.style.inset = "0";
      body.style.borderRadius = "2px";
      body.style.border = "1px solid color-mix(in srgb, var(--foreground) 45%, var(--background))";
      body.style.background = "color-mix(in srgb, var(--foreground) 25%, var(--background))";

      const stampSize = envH * 0.42;
      const stamp = document.createElement("div");
      stamp.style.position = "absolute";
      stamp.style.top = "0px";
      stamp.style.right = "0px";
      stamp.style.width = `${stampSize}px`;
      stamp.style.height = `${stampSize}px`;
      stamp.style.background = "color-mix(in srgb, var(--foreground) 82%, var(--background))";
      stamp.style.clipPath = "polygon(100% 0, 100% 100%, 0 0)";

      const inkSize = envH * 0.15;
      const ink = document.createElement("div");
      ink.style.pointerEvents = "none";
      ink.style.position = "absolute";
      ink.style.borderRadius = "9999px";
      ink.style.top = `${envH * 0.08}px`;
      ink.style.right = `${envH * 0.08}px`;
      ink.style.width = `${inkSize}px`;
      ink.style.height = `${inkSize}px`;
      ink.style.background = "var(--foreground)";
      ink.style.opacity = "0";

      rotEl.appendChild(body);
      rotEl.appendChild(stamp);
      rotEl.appendChild(ink);
      posEl.appendChild(rotEl);
      lane.appendChild(posEl);

      return { posEl, rotEl, inkEl: ink };
    };

    // -- reduced motion: render the GATE_FLIP freeze frame directly, no rAF
    // loop, no timers. One envelope mid-rotation exactly at the gate line
    // (gate flashed), one already-cancelled envelope ahead of it, one
    // not-yet-arrived envelope at a visibly different rotation behind it —
    // pre-gate, mid-flip and post-cancel states all legible in one frame. --
    if (reduced) {
      gate.style.transition = "none";
      gate.style.backgroundColor = "var(--foreground)";

      const place = (progress: number, rotation: number, ink: "none" | "shown") => {
        const { posEl, rotEl, inkEl } = makeEnvelope(rotation);
        const leadingEdge = progress * (laneWidth + 2 * envW);
        posEl.style.transform = `translateX(${leadingEdge - envW}px)`;
        if (ink === "shown") {
          rotEl.style.transform = "rotate(0deg)";
          inkEl.style.transition = "none";
          inkEl.style.opacity = "1";
        }
      };

      place(0.24, 270, "none"); // not yet arrived, visibly different rotation
      const mid = makeEnvelope(180);
      mid.posEl.style.transform = `translateX(${gateX - envW}px)`;
      mid.rotEl.style.transform = "rotate(90deg)"; // halfway through the 180deg -> 0deg flip
      place(0.82, 0, "shown"); // already cancelled, ahead of the gate

      return () => {
        lane.innerHTML = "";
      };
    }

    let spawnIndex = 0;
    let envelopes: EnvelopeHandle[] = [];
    let disposed = false;
    let visible = true;
    let clock = 0;
    let spawnAcc = 0;
    let last = 0;
    let raf = 0;

    const flashGate = (peakColor: string) => {
      gate.style.transition = "none";
      gate.style.backgroundColor = peakColor;
      void gate.offsetWidth; // force reflow so the decay below animates from the peak
      gate.style.transition = `background-color ${GATE_FLASH_MS}ms ease-out`;
      gate.style.backgroundColor = "var(--border)";
    };

    const scheduleCancel = (h: EnvelopeHandle, delay: number) => {
      const t1 = window.setTimeout(() => {
        if (disposed) return;
        h.inkEl.style.transition = "none";
        h.inkEl.style.opacity = "1";
        const t2 = window.setTimeout(() => {
          if (disposed) return;
          h.inkEl.style.transition = `opacity ${CANCEL_FADE_MS}ms ease-in`;
          h.inkEl.style.opacity = "0";
        }, CANCEL_HOLD_MS);
        h.timers.push(t2);
      }, delay);
      h.timers.push(t1);
    };

    const handleGate = (h: EnvelopeHandle) => {
      h.gated = true;
      if (h.rotation !== 0) {
        h.rotEl.style.transition = `transform ${FLIP_MS}ms ease-in-out`;
        h.rotEl.style.transform = "rotate(0deg)";
        flashGate("var(--foreground)");
        scheduleCancel(h, FLIP_MS + CANCEL_DELAY_MS);
      } else {
        // the 1-in-4 no-op case gets its own fainter beat rather than
        // passing silently — otherwise every envelope reads identical here.
        flashGate("color-mix(in srgb, var(--foreground) 45%, var(--border))");
        scheduleCancel(h, CANCEL_DELAY_MS);
      }
    };

    // atClock lets a pre-seeded envelope that is already past the gate at
    // mount (t0) be constructed already-resolved — rotEl snapped straight
    // to 0deg, no flash, no cancel schedule — instead of firing its gate
    // event on the first processed frame. Two flashes landing within one
    // frame of mount is a cadence a viewer can't follow; the machine has
    // been running before the demo mounted, so this envelope's flip (if
    // any) already happened off-frame, same as its predecessors.
    const spawnEnvelope = (spawnAt: number, rotation: number, atClock: number) => {
      const { posEl, rotEl, inkEl } = makeEnvelope(rotation);
      const progress = (atClock - spawnAt) / TRAVERSE_MS;
      const leadingEdge = progress * (laneWidth + 2 * envW);
      posEl.style.transform = `translateX(${leadingEdge - envW}px)`;
      const alreadyGated = leadingEdge >= gateX;
      if (alreadyGated) rotEl.style.transform = "rotate(0deg)";
      envelopes.push({ spawnAt, rotation, gated: alreadyGated, posEl, rotEl, inkEl, timers: [] });
    };

    const removeHandle = (h: EnvelopeHandle) => {
      h.timers.forEach((t) => window.clearTimeout(t));
      h.posEl.remove();
    };

    // t0 lane occupancy: several envelopes already staggered across the
    // lane, at least one pre-gate at a non-zero rotation.
    for (const p of PRESEED_PROGRESS) {
      spawnEnvelope(-p * TRAVERSE_MS, ROTATION_SEQUENCE[spawnIndex % 4] ?? 0, 0);
      spawnIndex += 1;
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible) {
        last = 0;
        return;
      }
      if (last === 0) {
        last = now;
        return;
      }
      const dt = Math.min(100, now - last);
      last = now;
      clock += dt;
      spawnAcc += dt;
      while (spawnAcc >= SPAWN_INTERVAL_MS) {
        spawnAcc -= SPAWN_INTERVAL_MS;
        spawnEnvelope(clock, ROTATION_SEQUENCE[spawnIndex % 4] ?? 0, clock);
        spawnIndex += 1;
      }
      for (let i = envelopes.length - 1; i >= 0; i--) {
        const h = envelopes[i];
        if (!h) continue;
        const progress = (clock - h.spawnAt) / TRAVERSE_MS;
        if (progress >= 1.05) {
          removeHandle(h);
          envelopes.splice(i, 1);
          continue;
        }
        const leadingEdge = progress * (laneWidth + 2 * envW);
        h.posEl.style.transform = `translateX(${leadingEdge - envW}px)`;
        if (!h.gated && leadingEdge >= gateX) handleGate(h);
      }
    };
    raf = requestAnimationFrame(loop);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) last = 0; // resync elapsed-time base on resume, no catch-up jump
    });
    io.observe(lane);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      envelopes.forEach(removeHandle);
      envelopes = [];
    };
  }, [envH, envW, laneWidth]);

  return (
    <div
      ref={rootRef}
      role="status"
      aria-label={label}
      className={`relative h-full w-full min-h-[120px] overflow-hidden ${className}`}
    >
      <div
        ref={gateRef}
        className="pointer-events-none absolute top-0 bottom-0"
        style={{ left: laneWidth * GATE_FRACTION, width: 2, background: "var(--border)" }}
      />
      <div ref={laneRef} className="absolute inset-0" />
    </div>
  );
}
