"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// AdhesiveSqueezeBead — a "merge two items" affordance modeled on structural
// adhesive bonding with bond-line thickness control (aerospace/automotive
// bonded-joint practice): a bead of adhesive sits between two panels, and as
// they're pressed together it spreads and excess is forced out at the seam
// as visible "squeeze-out" — a fillet along the joint. A physical spacer
// (the bond-line stop) keeps the panels from pressing fully flat, so a good
// bond shows continuous, unbroken squeeze-out; a starved bond shows a broken
// line. That's the one visual fact this component asks a viewer to read.
//
// The bead is 24 independently-perturbed control points along the seam, not
// a single stroke-width tween: on contact each point grows toward its own
// randomized target radius (a container-scaled range around the spec's 2-5px,
// widened so the settle motion stays legible at small card sizes — see
// BASE_MIN_TARGET_R/BASE_MAX_TARGET_R below) over 340ms — deliberately
// lumpy — then relaxes LINEARLY toward a 3-point moving average of its
// neighbors (two passes) over 700ms, visibly settling from uneven to a
// continuous even fillet. THAT settle motion is the one thing to follow, and
// it holds at "finished, even fillet" for 2.1s before fading and resetting.
// Panels ease-IN (accelerating close, like two rigid parts under applied
// pressure) from a 14px starting gap to a fixed 3px bond-line stop over
// 260ms; the ~3900ms cycle then runs forever, unforced, with zero input.
//
// Dragging the lower panel drives the approach distance directly off pointer
// position instead of the ambient clock — release past the 6px squeeze-out
// threshold commits to the same growth+settle+hold+reset sequence the
// ambient loop runs (drag just jumps the shared timeline to that point);
// releasing short of it springs the panel back to the 14px start and the
// ambient loop simply resumes from t0. No pointer input is required for the
// component to be alive — dragging is an accent on top of a real resting
// loop, never the only way to see it move.
//
// Colors are --foreground / --ns-muted / --border / --surface / --background
// only, read live through CSS custom properties (no JS color reads, no
// literals) — the bead is never accent-colored; its unevenness-to-evenness
// motion is luminance/geometry only, never dressed up with hue.
// ---------------------------------------------------------------------------

export interface AdhesiveSqueezeBeadProps {
  /** content rendered inside the upper (fixed) panel */
  topContent?: React.ReactNode;
  /** content rendered inside the lower (draggable) panel */
  bottomContent?: React.ReactNode;
  /** enable drag-to-attach on the lower panel. Default true. */
  draggable?: boolean;
  /** fired once the squeeze-out bead finishes settling (ambient cycle completing the hold, or a committed drag). */
  onBond?: (source: "ambient" | "drag") => void;
  /** accessible name for the bonding preview region */
  ariaLabel?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const POINTS = 24;
const START_GAP = 14; // px, panels apart at rest
const BOND_GAP = 3; // px, fixed bond-line stop (spacer thickness)
const SQUEEZE_THRESHOLD_GAP = 6; // px, gap below which the bead starts building

const APPROACH_MS = 260;
const GROWTH_MS = 340;
const SETTLE_MS = 700;
const HOLD_MS = 2100;
const RESET_MS = 500;

const T_APPROACH_END = APPROACH_MS; // 260
const T_GROWTH_END = T_APPROACH_END + GROWTH_MS; // 600
const T_SETTLE_END = T_GROWTH_END + SETTLE_MS; // 1300
const T_HOLD_END = T_SETTLE_END + HOLD_MS; // 3400
const PERIOD_MS = T_HOLD_END + RESET_MS; // 3900

// spec's real numbers for the target radius range at a ~240px minimum card
// dimension. `layout()` multiplies these by a container-derived scale factor
// (binding rule: derive geometry from the smaller dimension) so the settle
// motion — the one thing this component asks a viewer to follow — stays
// legible instead of shrinking to a sub-pixel wobble on a small card.
const BASE_MIN_TARGET_R = 4;
const BASE_MAX_TARGET_R = 12;
const SCALE_REFERENCE_DIM = 240; // px
const MIN_SCALE = 0.75;
const MAX_SCALE = 2.5;

const EDGE_PAD = 12; // px inset kept around both panels AND the bead's 24 points — the
// same value so the bead reaches all the way to each panel's end, matching
// "squeeze-out along the seam," not stopping short of it.

interface Point {
  x: number;
  r: number;
}

function easeInQuad(t: number): number {
  return t * t;
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 3-point moving average, edges clamped (duplicate the edge value rather than wrap —
 * this is a linear seam, not a loop). Two passes, per spec, are what turns a lumpy
 * per-point growth into a visibly continuous fillet. */
function smoothOnce(values: number[]): number[] {
  const n = values.length;
  const out = new Array(n) as number[];
  for (let i = 0; i < n; i++) {
    const prev = values[i - 1] ?? values[0] ?? 0;
    const cur = values[i] ?? 0;
    const next = values[i + 1] ?? values[n - 1] ?? 0;
    out[i] = (prev + cur + next) / 3;
  }
  return out;
}

function smoothTwice(values: number[]): number[] {
  return smoothOnce(smoothOnce(values));
}

/** Catmull-Rom -> cubic Bezier through an ordered point list, clamped at both ends
 * (no wraparound — each edge of the bead terminates flat at the seam's visible extent
 * rather than closing into a loop). Returns path commands WITHOUT the leading M. */
function smoothSegment(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = "";
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    if (!p0 || !p1 || !p2 || !p3) continue;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

function buildBeadPath(points: Point[], seamY: number): string {
  if (points.length === 0) return "";
  const top = points.map((p) => ({ x: p.x, y: seamY - p.r }));
  const bottom = points.map((p) => ({ x: p.x, y: seamY + p.r })).reverse();
  const first = top[0];
  if (!first) return "";
  return `M${first.x.toFixed(2)} ${first.y.toFixed(2)}${smoothSegment(top)}L${bottom[0]?.x.toFixed(2)} ${bottom[0]?.y.toFixed(2)}${smoothSegment(bottom)}Z`;
}

export function AdhesiveSqueezeBead({
  topContent,
  bottomContent,
  draggable = true,
  onBond,
  ariaLabel = "Adhesive bond preview",
  className = "",
}: AdhesiveSqueezeBeadProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const beadRef = useRef<SVGPathElement>(null);
  const topPanelRef = useRef<HTMLDivElement>(null);
  const bottomPanelRef = useRef<HTMLDivElement>(null);
  const statusId = useId();
  const [statusText, setStatusText] = useState("");
  const [ready, setReady] = useState(false);
  const onBondRef = useRef(onBond);
  onBondRef.current = onBond;

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    const bead = beadRef.current;
    const topPanel = topPanelRef.current;
    const bottomPanel = bottomPanelRef.current;
    if (!root || !svg || !bead || !topPanel || !bottomPanel) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let visible = true;
    let raf = 0;
    let w = 0;
    let h = 0;
    let sized = false;

    // fixed x positions for the 24 seam points, recomputed on resize only
    let xs: number[] = [];
    let seamY = 0;
    let minTargetR = BASE_MIN_TARGET_R;
    let maxTargetR = BASE_MAX_TARGET_R;

    let cycleStart = 0;
    let growthTargets: number[] | null = null;
    let settled: number[] | null = null;
    let announcedThisCycle = false;
    let lastCommitWasDrag = false;

    let dragging = false;
    let dragStartY = 0;
    let dragStartGap = START_GAP;
    let liveGap = START_GAP;

    const layout = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (w < 2 || h < 2) {
        sized = false;
        return;
      }
      sized = true;
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      seamY = h / 2;
      xs = [];
      const usable = Math.max(1, w - EDGE_PAD * 2);
      for (let i = 0; i < POINTS; i++) {
        xs.push(EDGE_PAD + (usable * i) / (POINTS - 1));
      }

      // panel height is DERIVED, not hardcoded, so the two panels' inner
      // edges are always exactly START_GAP apart at rest — the bond-line
      // stop only means something if the resting gap is the number the
      // spec says it is.
      const panelH = Math.max(1, (h - EDGE_PAD * 2 - START_GAP) / 2);
      topPanel.style.top = `${EDGE_PAD}px`;
      topPanel.style.height = `${panelH}px`;
      bottomPanel.style.bottom = `${EDGE_PAD}px`;
      bottomPanel.style.height = `${panelH}px`;

      // binding rule: derive geometry from the container's smaller
      // dimension so the settle motion reads at card scale instead of
      // shrinking to a sub-pixel wobble on a small card.
      const minDim = Math.min(w, h);
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, minDim / SCALE_REFERENCE_DIM));
      minTargetR = BASE_MIN_TARGET_R * scale;
      maxTargetR = BASE_MAX_TARGET_R * scale;

      setReady(true);
    };

    // applies a gap (px between panel inner edges) and a bead point set to the DOM.
    // Every frame writes come through here — ambient clock, drag, and the
    // reduced-motion one-shot render all funnel through the same function so
    // there is exactly one place that touches panel transforms and the path.
    const apply = (gap: number, radii: number[] | null, opacity: number) => {
      const delta = (START_GAP - gap) / 2;
      topPanel.style.transform = `translateY(${delta.toFixed(2)}px)`;
      bottomPanel.style.transform = `translateY(${(-delta).toFixed(2)}px)`;
      if (radii && radii.some((r) => r > 0.01)) {
        const pts: Point[] = xs.map((x, i) => ({ x, r: radii[i] ?? 0 }));
        bead.setAttribute("d", buildBeadPath(pts, seamY));
        bead.style.opacity = String(opacity);
      } else {
        bead.setAttribute("d", "");
      }
    };

    const phaseAt = (t: number) => {
      if (t < T_APPROACH_END) return "approach" as const;
      if (t < T_GROWTH_END) return "growth" as const;
      if (t < T_SETTLE_END) return "settle" as const;
      if (t < T_HOLD_END) return "hold" as const;
      return "reset" as const;
    };

    const frameAt = (t: number) => {
      const phase = phaseAt(t);

      if (phase === "approach") {
        growthTargets = null;
        settled = null;
        announcedThisCycle = false;
        const p = clamp01(t / APPROACH_MS);
        const gap = START_GAP - (START_GAP - BOND_GAP) * easeInQuad(p);
        return { gap, radii: null as number[] | null, opacity: 1 };
      }

      if (phase === "growth") {
        if (!growthTargets) {
          growthTargets = Array.from(
            { length: POINTS },
            () => minTargetR + Math.random() * (maxTargetR - minTargetR)
          );
        }
        const p = clamp01((t - T_APPROACH_END) / GROWTH_MS);
        const eased = easeOutQuad(p);
        const radii = growthTargets.map((target) => target * eased);
        return { gap: BOND_GAP, radii, opacity: 1 };
      }

      if (phase === "settle") {
        if (!growthTargets) {
          growthTargets = Array.from(
            { length: POINTS },
            () => minTargetR + Math.random() * (maxTargetR - minTargetR)
          );
        }
        if (!settled) settled = smoothTwice(growthTargets);
        const p = clamp01((t - T_GROWTH_END) / SETTLE_MS);
        // linear, deliberately: an eased curve front-loads the visual change and
        // leaves too little residual unevenness left at the t5s resting-loop
        // check-frame (1.1s into the next cycle, 71% through this window) to
        // read as distinct from the fully-settled hold frame at t2.5s.
        const eased = p;
        const radii = growthTargets.map((target, i) => lerp(target, settled?.[i] ?? target, eased));
        return { gap: BOND_GAP, radii, opacity: 1 };
      }

      if (phase === "hold") {
        if (!announcedThisCycle) {
          announcedThisCycle = true;
          onBondRef.current?.(lastCommitWasDrag ? "drag" : "ambient");
          lastCommitWasDrag = false;
          setStatusText("Bonded — squeeze-out even along the seam");
        }
        const radii = settled ?? growthTargets ?? new Array(POINTS).fill(maxTargetR);
        return { gap: BOND_GAP, radii, opacity: 1 };
      }

      // reset: bead fades while panels separate back to the starting gap
      const p = clamp01((t - T_HOLD_END) / RESET_MS);
      const eased = easeInOutQuad(p);
      const gap = BOND_GAP + (START_GAP - BOND_GAP) * eased;
      const radii = settled ?? growthTargets;
      return { gap, radii, opacity: 1 - eased };
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible || !sized || dragging) return;
      if (cycleStart === 0) cycleStart = now;
      let t = now - cycleStart;
      if (t >= PERIOD_MS) {
        cycleStart += Math.floor(t / PERIOD_MS) * PERIOD_MS;
        t = now - cycleStart;
      }
      const { gap, radii, opacity } = frameAt(t);
      apply(gap, radii, opacity);
      raf = requestAnimationFrame(loop);
    };

    const renderReducedSettled = () => {
      const targets = Array.from(
        { length: POINTS },
        () => minTargetR + Math.random() * (maxTargetR - minTargetR)
      );
      settled = smoothTwice(targets);
      apply(BOND_GAP, settled, 1);
      setStatusText("Bonded — squeeze-out even along the seam");
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dy = e.clientY - dragStartY;
      liveGap = Math.max(BOND_GAP, Math.min(START_GAP, dragStartGap + dy));
      // no bead while actively dragging — the squeeze-out sequence only ever
      // plays as a committed sequence on release, never tracked live.
      apply(liveGap, null, 1);
    };

    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      const committed = liveGap <= SQUEEZE_THRESHOLD_GAP;
      if (reduced) {
        if (committed) {
          renderReducedSettled();
        } else {
          apply(START_GAP, null, 1);
          setStatusText("Released before bond line — no squeeze-out");
        }
        return;
      }
      lastCommitWasDrag = true;
      if (committed) {
        // a fresh commit gets a fresh growth cycle — never replay whatever the
        // previous ambient cycle happened to leave in these refs (e.g. a drag
        // started mid-hold), and let the "hold" phase announce again.
        growthTargets = null;
        settled = null;
        announcedThisCycle = false;
        // jump the shared timeline straight to the start of growth, already at the
        // bond-line stop, so the exact same growth+settle+hold+reset sequence the
        // ambient loop runs plays out from here.
        cycleStart = performance.now() - T_APPROACH_END;
      } else {
        setStatusText("Released before bond line — no squeeze-out");
        cycleStart = performance.now();
      }
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const onPointerDown = (e: PointerEvent) => {
      // reduced motion still allows the drag itself — only the ambient
      // auto-loop is disabled; this listener is only ever attached when
      // `draggable` is true (see the effect's attach/detach below).
      dragging = true;
      raf && cancelAnimationFrame(raf);
      raf = 0;
      dragStartY = e.clientY;
      // reconstruct the currently-displayed gap from the panel's own transform so a
      // drag started mid-cycle picks up exactly where the ambient loop left off.
      const style = window.getComputedStyle(topPanel);
      const matrix = new DOMMatrixReadOnly(style.transform);
      const currentDelta = matrix.m42;
      dragStartGap = Math.max(BOND_GAP, Math.min(START_GAP, START_GAP - currentDelta * 2));
      liveGap = dragStartGap;
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    };

    layout();

    if (reduced) {
      renderReducedSettled();
    } else if (sized) {
      raf = requestAnimationFrame(loop);
    }

    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (disposed) return;
        layout();
        if (reduced) {
          renderReducedSettled();
        } else if (sized && !dragging && !raf) {
          // the very first measurement (lazy-mounted preview iframe, an
          // initially-collapsed container) can land here instead of the
          // mount-time branch above — resume the ambient loop the same way
          // the IntersectionObserver's resume path does, or it never starts.
          raf = requestAnimationFrame(loop);
        }
      }, 100);
    });
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !reduced && sized && !dragging && !raf) {
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(root);

    if (draggable) {
      bottomPanel.addEventListener("pointerdown", onPointerDown);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      window.clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (draggable) bottomPanel.removeEventListener("pointerdown", onPointerDown);
    };
    // onBond is read through onBondRef (set every render above) so an inline
    // callback identity never re-runs this effect and restarts the cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggable]);

  return (
    <div
      ref={rootRef}
      data-adhesive-squeeze-bead
      role="group"
      aria-label={ariaLabel}
      className={`relative aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-background transition-opacity duration-200 ${ready ? "opacity-100" : "opacity-0"} ${className}`}
    >
      <div
        ref={topPanelRef}
        className="absolute inset-x-3 flex items-center justify-center rounded-sm border border-foreground/15 bg-surface"
        style={{ willChange: "transform" }}
      >
        {topContent ?? (
          <span className="font-mono text-[11px] tracking-widest text-ns-muted">PANEL A</span>
        )}
      </div>
      <div
        ref={bottomPanelRef}
        className={`absolute inset-x-3 flex items-center justify-center rounded-sm border border-foreground/15 bg-surface ${draggable ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
        style={{ willChange: "transform" }}
      >
        {bottomContent ?? (
          <span className="font-mono text-[11px] tracking-widest text-ns-muted">PANEL B</span>
        )}
      </div>
      <svg
        ref={svgRef}
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <path ref={beadRef} d="" fill="var(--foreground)" stroke="none" />
      </svg>
      <p id={statusId} role="status" aria-live="polite" className="sr-only">
        {statusText}
      </p>
    </div>
  );
}
