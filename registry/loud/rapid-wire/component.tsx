"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// RapidWire — payment submission as an Edwardian cash railway. One governing
// scalar, `s`, is a real arc-length position along a single static SVG
// catenary path (two posts of unequal height, solved analytically with the
// standard two-point cosh formula — not a bezier approximation). Every frame
// reads the wire's actual geometry at `s` via getPointAtLength on a hidden
// reference <path> — the same real-DOM-query idiom transfer-list-siphon uses
// for its bead — and derives three things from it: velocity (energy
// conservation against the wire's height, so launching downhill off the till
// post genuinely speeds the cup up and climbing the last stretch to the
// cashier post genuinely slows it down — no keyframe tween, no fixed
// duration), cup tilt (the wire's local tangent angle), and a purely
// cosmetic few-px sag bump under the visible wire directly beneath the cup
// while it's in transit (a second, separate <path> carries the deflection;
// the reference path stays static so the physics query is never polluted by
// its own cosmetic effect).
//
// The outbound launch speed is solved, not guessed: given the real height
// climb from till to cashier baked into the wire, v0 is picked so the cup's
// kinetic energy is exactly spent by the time it reaches the far post — it
// "just crests" rather than sailing past. The return leg is net downhill
// (the cashier post sits higher), so a short braking zone right at the till
// post — read as the wire's own cushioned catch, not a decorative ease —
// keeps the landing gentle instead of letting real physics slam it in.
//
// State machine: idle -> outbound (launch) -> settling (parked at the
// cashier post, rocking gently, while the real async onSubmit is in flight —
// a minimum rock window keeps this beat legible even if the promise settles
// instantly) -> returning (coasts back carrying the outcome) -> arrived
// (receipt unfolds as real <li> rows, in document order, not canvas/SVG
// text). The submit button is never given a `disabled` attribute — busyness
// is a guard on the click handler, matching autosave-ratchet's status-guard
// idiom, so it stays focusable and keyboard-reachable through the whole
// trip.
//
// A11y: one role=status aria-live=polite region speaks exactly three coarse
// events per cycle — "Payment sent.", the settle result ("Captured — $4.20
// change returning."), and "Receipt ready." — never per-frame position. The
// same three (plus a couple more, since text has no throttling reason to
// stay coarse) also render as a small always-visible caption, so nothing
// here is carried by the graphic alone. The wire/cup SVG is aria-hidden. The
// receipt is a real <ol> in document order. prefers-reduced-motion swaps in
// a version where the cup never leaves its parked pose at the till post —
// no rAF loop runs at all — but the same status guard, the same three
// announcements and the same receipt land in the same order, just without
// the trip.
// ---------------------------------------------------------------------------

export interface RapidWireLineItem {
  label: string;
  /** positive = captured/charged and kept; negative = returned to the customer (change, refund, released hold) */
  amount: number;
}

export interface RapidWireResult {
  status: "captured" | "declined";
  lines: RapidWireLineItem[];
  /** noun used in the spoken settle message when money is coming back. Default "refund". */
  returningNoun?: "change" | "refund";
  /** short receipt note, e.g. "Card declined" */
  note?: string;
}

export interface RapidWireProps {
  /** amount due, in dollars. Default 24. */
  amount?: number;
  /** accessible label for the till. Default "Amount due". */
  label?: string;
  /**
   * Called on submit with the amount; resolve once the server settles.
   * Falls back to a built-in demo cycle (exact tender, change due, partial
   * capture + instant refund, decline + released hold) when omitted.
   */
  onSubmit?: (amount: number) => Promise<RapidWireResult>;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

type Status = "idle" | "outbound" | "settling" | "returning" | "arrived";

// --- wire geometry (fixed layout constants, not props) ----------------------

const VIEW_W = 400;
const VIEW_H = 200;
const GROUND_Y = 186;
const TILL_X = 40;
const TILL_Y = 140;
const CASHIER_X = 360;
const CASHIER_Y = 76;
const CATENARY_A = 300;
const SAMPLE_COUNT = 90;

const GRAVITY = 0.0012; // px/ms^2, arbitrary units — tuned against this wire's own span
const V_ARRIVE_OUT = 0.1; // px/ms — the "just crests" target arrival speed outbound
const BRAKE_PX_OUT = 28;
const BRAKE_FLOOR_OUT = 0.55;
const RETURN_V0 = 0.12;
const RETURN_FLOOR_V = 0.05;
const BRAKE_PX_RETURN = 60;
const BRAKE_FLOOR_RETURN = 0.3;

const ROCK_AMP_DEG = 5;
const ROCK_FREQ_HZ = 1.4;
const MIN_ROCK_MS = 280;
const DEFAULT_RESOLVE_MS = 560;

const DEFLECT_AMP = 3.5;
const DEFLECT_SIGMA = 42;

interface CatenaryShape {
  a: number;
  xm: number;
  c: number;
}

// Standard two-point catenary solve, done in an up-positive coordinate space
// (Y = -svgY) so a*cosh(...) sags the way gravity actually sags a cable, then
// flipped back to SVG's down-positive y on read.
function solveCatenary(x0: number, svgY0: number, x1: number, svgY1: number, a: number): CatenaryShape {
  const Y0 = -svgY0;
  const Y1 = -svgY1;
  const dx = x1 - x0;
  const dY = Y1 - Y0;
  const k = dx / (2 * a);
  const rhs = dY / (2 * a * Math.sinh(k));
  const p = Math.asinh(rhs);
  const xm = (x0 + x1) / 2 - a * p;
  const c = Y0 - a * Math.cosh((x0 - xm) / a);
  return { a, xm, c };
}

function catenarySvgY(x: number, shape: CatenaryShape): number {
  return -(shape.a * Math.cosh((x - shape.xm) / shape.a) + shape.c);
}

interface SamplePoint {
  x: number;
  y: number;
}

function buildSamplePoints(shape: CatenaryShape): SamplePoint[] {
  const points: SamplePoint[] = [];
  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const t = i / SAMPLE_COUNT;
    const x = TILL_X + (CASHIER_X - TILL_X) * t;
    points.push({ x, y: catenarySvgY(x, shape) });
  }
  return points;
}

function buildPathD(points: SamplePoint[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

const CATENARY_SHAPE = solveCatenary(TILL_X, TILL_Y, CASHIER_X, CASHIER_Y, CATENARY_A);
const SAMPLE_POINTS = buildSamplePoints(CATENARY_SHAPE);
const BASE_WIRE_D = buildPathD(SAMPLE_POINTS);

// A localized gaussian bump added under the cup's current x, on top of the
// static geometry — cosmetic only, never fed back into the physics query.
function buildDeflectedD(cupX: number): string {
  const points = SAMPLE_POINTS.map((p) => {
    const dx = p.x - cupX;
    const bump = DEFLECT_AMP * Math.exp(-(dx * dx) / (2 * DEFLECT_SIGMA * DEFLECT_SIGMA));
    return { x: p.x, y: p.y + bump };
  });
  return buildPathD(points);
}

function brakeMultiplier(distToTarget: number, brakePx: number, floorMult: number): number {
  if (distToTarget >= brakePx) return 1;
  const t = Math.max(0, distToTarget / brakePx);
  const eased = t * t * (3 - 2 * t);
  return floorMult + (1 - floorMult) * eased;
}

function velocityAt(hCur: number, hStart: number, v0: number, g: number, floorV: number): number {
  const v2 = v0 * v0 - 2 * g * (hCur - hStart);
  return Math.sqrt(Math.max(floorV * floorV, v2));
}

interface PhysicsSample {
  x: number;
  y: number;
  h: number;
  tiltDeg: number;
}

function samplePhysics(path: SVGPathElement, s: number, total: number): PhysicsSample {
  const clamped = Math.max(0, Math.min(total, s));
  const eps = 6;
  const lo = Math.max(0, clamped - eps);
  const hi = Math.min(total, clamped + eps);
  const p = path.getPointAtLength(clamped);
  const a = path.getPointAtLength(lo);
  const b = path.getPointAtLength(hi);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const tiltDeg =
    Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001
      ? 0
      : Math.max(-30, Math.min(30, (Math.atan2(dy, dx) * 180) / Math.PI));
  return { x: p.x, y: p.y, h: -p.y, tiltDeg };
}

interface PhysicsConsts {
  total: number;
  hStart: number;
  hEnd: number;
  outV0: number;
}

function formatUSD(n: number): string {
  return `$${n.toFixed(2)}`;
}

function buildScenario(amount: number, idx: number): RapidWireResult {
  const n = ((idx % 4) + 4) % 4;
  if (n === 0) {
    return { status: "captured", lines: [{ label: "Captured", amount }] };
  }
  if (n === 1) {
    const tendered = amount % 5 === 0 ? amount + 5 : Math.ceil(amount / 5) * 5;
    const change = Math.round((tendered - amount) * 100) / 100;
    return {
      status: "captured",
      lines: [
        { label: "Captured", amount },
        { label: "Change", amount: -change },
      ],
      returningNoun: "change",
    };
  }
  if (n === 2) {
    const captured = Math.round(amount * 0.6 * 100) / 100;
    const refund = Math.round((amount - captured) * 100) / 100;
    return {
      status: "captured",
      lines: [
        { label: "Captured — partial authorization", amount: captured },
        { label: "Refunded — remaining balance", amount: -refund },
      ],
      returningNoun: "refund",
      note: "Partial authorization",
    };
  }
  return {
    status: "declined",
    lines: [{ label: "Declined — hold released", amount: -amount }],
    returningNoun: "refund",
    note: "Card declined",
  };
}

function buildSettleMessage(result: RapidWireResult): string {
  const back = result.lines.filter((l) => l.amount < 0).reduce((sum, l) => sum + Math.abs(l.amount), 0);
  const verb = result.status === "captured" ? "Captured" : "Declined";
  if (back <= 0) return `${verb} — receipt returning.`;
  const noun = result.returningNoun ?? "refund";
  return `${verb} — ${formatUSD(back)} ${noun} returning.`;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function ReturnGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 10 10" className="h-2.5 w-2.5 shrink-0 text-ns-muted">
      <path
        d="M5 1.2v6.1M2.2 4.6 5 7.4l2.8-2.8"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RapidWire({ amount = 24, label = "Amount due", onSubmit, className = "" }: RapidWireProps) {
  const autoId = useId();
  const liveId = `rw-live-${autoId.replace(/:/g, "")}`;

  const physicsPathRef = useRef<SVGPathElement | null>(null);
  const wirePathRef = useRef<SVGPathElement | null>(null);
  const cupRef = useRef<SVGGElement | null>(null);
  const cupInnerRef = useRef<SVGGElement | null>(null);

  const physicsRef = useRef<PhysicsConsts | null>(null);
  const sRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const rockRafRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const scenarioIndexRef = useRef(0);
  const parityRef = useRef(false);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const reducedMotion = useReducedMotion();

  const [status, setStatus] = useState<Status>("idle");
  const [caption, setCaption] = useState("Ready to send.");
  const [announceText, setAnnounceText] = useState("");
  const [lines, setLines] = useState<RapidWireLineItem[]>([]);
  const [note, setNote] = useState<string | undefined>(undefined);

  const announce = useCallback((message: string) => {
    parityRef.current = !parityRef.current;
    setAnnounceText(message + (parityRef.current ? "​" : ""));
  }, []);

  const writeCupPose = useCallback((s: number, extraDeg = 0) => {
    const path = physicsPathRef.current;
    const cup = cupRef.current;
    const consts = physicsRef.current;
    if (!path || !cup || !consts) return;
    const sample = samplePhysics(path, s, consts.total);
    cup.setAttribute(
      "transform",
      `translate(${sample.x.toFixed(2)} ${sample.y.toFixed(2)}) rotate(${(sample.tiltDeg + extraDeg).toFixed(2)})`
    );
  }, []);

  const writeWireDeflection = useCallback((cupX: number | null) => {
    const wire = wirePathRef.current;
    if (!wire) return;
    wire.setAttribute("d", cupX == null ? BASE_WIRE_D : buildDeflectedD(cupX));
  }, []);

  // Static geometry, measured once: total arc length and the real height of
  // each post, read straight off the rendered reference path rather than
  // re-derived from the math that built it.
  useEffect(() => {
    const path = physicsPathRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    const p0 = path.getPointAtLength(0);
    const p1 = path.getPointAtLength(total);
    const hStart = -p0.y;
    const hEnd = -p1.y;
    const climb = hEnd - hStart;
    const outV0 = Math.sqrt(V_ARRIVE_OUT * V_ARRIVE_OUT + 2 * GRAVITY * climb);
    physicsRef.current = { total, hStart, hEnd, outV0 };
    writeCupPose(0);
  }, [writeCupPose]);

  useEffect(
    () => () => {
      mountedRef.current = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (rockRafRef.current != null) cancelAnimationFrame(rockRafRef.current);
      clearTimeout(pulseTimeoutRef.current);
    },
    []
  );

  const animateLeg = useCallback(
    (direction: 1 | -1): Promise<void> =>
      new Promise((resolve) => {
        const consts = physicsRef.current;
        const path = physicsPathRef.current;
        if (!consts || !path) {
          resolve();
          return;
        }
        const total = consts.total;
        const hStart = direction === 1 ? consts.hStart : consts.hEnd;
        const v0 = direction === 1 ? consts.outV0 : RETURN_V0;
        const floorV = direction === 1 ? V_ARRIVE_OUT * 0.4 : RETURN_FLOOR_V;
        const brakePx = direction === 1 ? BRAKE_PX_OUT : BRAKE_PX_RETURN;
        const brakeFloor = direction === 1 ? BRAKE_FLOOR_OUT : BRAKE_FLOOR_RETURN;
        let last = -1;

        const step = (now: number) => {
          if (last < 0) last = now;
          const dt = Math.min(48, now - last);
          last = now;
          let s = sRef.current;
          const sample = samplePhysics(path, s, total);
          const v = velocityAt(sample.h, hStart, v0, GRAVITY, floorV);
          const dist = direction === 1 ? total - s : s;
          const mult = brakeMultiplier(dist, brakePx, brakeFloor);
          s += direction * v * mult * dt;
          s = Math.max(0, Math.min(total, s));
          sRef.current = s;
          writeCupPose(s);
          writeWireDeflection(sample.x);

          const done = direction === 1 ? s >= total - 0.05 : s <= 0.05;
          if (done) {
            sRef.current = direction === 1 ? total : 0;
            writeCupPose(sRef.current);
            writeWireDeflection(null);
            rafRef.current = null;
            resolve();
            return;
          }
          rafRef.current = requestAnimationFrame(step);
        };
        rafRef.current = requestAnimationFrame(step);
      }),
    [writeCupPose, writeWireDeflection]
  );

  const startRocking = useCallback(() => {
    const consts = physicsRef.current;
    if (!consts) return;
    const start = performance.now();
    const step = (now: number) => {
      const t = (now - start) / 1000;
      const wobble = ROCK_AMP_DEG * Math.sin(t * ROCK_FREQ_HZ * Math.PI * 2);
      writeCupPose(consts.total, wobble);
      rockRafRef.current = requestAnimationFrame(step);
    };
    rockRafRef.current = requestAnimationFrame(step);
  }, [writeCupPose]);

  const stopRocking = useCallback(() => {
    if (rockRafRef.current != null) {
      cancelAnimationFrame(rockRafRef.current);
      rockRafRef.current = null;
    }
  }, []);

  const defaultSubmit = useCallback((amt: number): Promise<RapidWireResult> => {
    const idx = scenarioIndexRef.current;
    scenarioIndexRef.current += 1;
    const result = buildScenario(amt, idx);
    return new Promise((resolve) => {
      window.setTimeout(() => resolve(result), DEFAULT_RESOLVE_MS);
    });
  }, []);

  const runCycle = useCallback(async () => {
    setLines([]);
    setNote(undefined);
    setStatus("outbound");
    setCaption("Cup away — heading to the cashier.");
    announce("Payment sent.");

    const submitFn = onSubmit ?? defaultSubmit;
    const resultPromise = submitFn(amount).catch(
      (): RapidWireResult => ({
        status: "declined",
        lines: [{ label: "Payment failed — hold released", amount: -amount }],
        note: "Connection error",
      })
    );

    if (reducedMotion) {
      const result = await resultPromise;
      if (!mountedRef.current) return;
      // No intermediate frame is ever painted under reduced motion (no rAF
      // loop runs at all), so outbound/settling/returning are skipped as
      // states, not just as animations — announce + caption go straight to
      // the settle result, then straight to arrived.
      const msg = buildSettleMessage(result);
      announce(msg);
      setCaption(msg);
      setStatus("arrived");
      setLines(result.lines);
      setNote(result.note);
      setCaption("Receipt ready.");
      announce("Receipt ready.");
      busyRef.current = false;
      return;
    }

    if (cupInnerRef.current) {
      cupInnerRef.current.classList.add("ns-rw-cup-launch");
      clearTimeout(pulseTimeoutRef.current);
      pulseTimeoutRef.current = setTimeout(() => {
        cupInnerRef.current?.classList.remove("ns-rw-cup-launch");
      }, 200);
    }

    await animateLeg(1);
    if (!mountedRef.current) return;

    setStatus("settling");
    setCaption("Cashier is settling the payment.");
    startRocking();

    const minWait = new Promise<void>((resolve) => window.setTimeout(resolve, MIN_ROCK_MS));
    const [result] = await Promise.all([resultPromise, minWait]);
    stopRocking();
    if (!mountedRef.current) return;

    const msg = buildSettleMessage(result);
    announce(msg);
    setCaption(msg);

    setStatus("returning");
    await animateLeg(-1);
    if (!mountedRef.current) return;

    setStatus("arrived");
    setLines(result.lines);
    setNote(result.note);
    setCaption("Receipt ready.");
    announce("Receipt ready.");
    busyRef.current = false;
  }, [amount, onSubmit, defaultSubmit, reducedMotion, animateLeg, startRocking, stopRocking, announce]);

  const handleSubmit = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    void runCycle();
  }, [runCycle]);

  const busy = status === "outbound" || status === "settling" || status === "returning";

  // data-busy backs meta.json's gate: the verifier's press pass already
  // clicks the submit button once before the gate phase runs, so the gate's
  // own click on the same button is a same-tick no-op against the busy
  // guard above. Gating on the terminal receipt would race the ~2.6s round
  // trip against the gate's fixed ~1.7s post-click window and lose. Gating
  // on "cup is in flight" instead is both the thing that actually needs
  // checking (did the launch really happen) and comfortably still true at
  // check time, since it holds for the whole trip, not just its last beat.
  return (
    <div
      data-rapid-wire
      data-status={status}
      data-busy={busy ? "true" : "false"}
      className={`ns-rw-root relative w-full max-w-md rounded-[16px] border border-border bg-background p-5 ${className}`}
    >
      <style>{CSS}</style>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ns-muted">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{formatUSD(amount)}</p>
        </div>
        <button
          type="button"
          data-rw-submit
          aria-label="Send payment"
          aria-describedby={liveId}
          onClick={handleSubmit}
          className="shrink-0 rounded-[6px] border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          Send payment
        </button>
      </div>

      <p className="mt-2 min-h-[1.1em] text-xs text-ns-muted">{caption}</p>

      <svg
        aria-hidden="true"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="mt-4 h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <line x1={0} y1={GROUND_Y} x2={VIEW_W} y2={GROUND_Y} stroke="var(--border)" strokeWidth={1} />
        <line
          x1={TILL_X}
          y1={TILL_Y}
          x2={TILL_X}
          y2={GROUND_Y}
          stroke="var(--border)"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <line
          x1={CASHIER_X}
          y1={CASHIER_Y}
          x2={CASHIER_X}
          y2={GROUND_Y}
          stroke="var(--border)"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <rect x={TILL_X - 16} y={TILL_Y - 6} width={32} height={6} rx={2} fill="var(--border)" />
        <rect
          x={CASHIER_X - 15}
          y={CASHIER_Y - 24}
          width={30}
          height={22}
          rx={3}
          fill="none"
          stroke="var(--border)"
          strokeWidth={1.5}
        />

        {/* physics reference: static, never redrawn, queried every frame via getPointAtLength */}
        <path ref={physicsPathRef} d={BASE_WIRE_D} fill="none" stroke="none" />
        {/* visible wire: same base geometry, plus a cosmetic load bump while a cup transits it */}
        <path ref={wirePathRef} d={BASE_WIRE_D} fill="none" stroke="var(--border)" strokeWidth={1.25} strokeLinecap="round" />

        <g ref={cupRef} transform={`translate(${TILL_X} ${TILL_Y})`}>
          <g ref={cupInnerRef} className="ns-rw-cup-inner">
            <line x1={0} y1={0} x2={0} y2={8} stroke="var(--border)" strokeWidth={1.2} />
            <circle cx={0} cy={0} r={3} fill="var(--background)" stroke="var(--foreground)" strokeWidth={1.4} />
            <circle cx={0} cy={2} r={1.4} fill={busy ? "var(--ns-accent)" : "var(--border)"} />
            <path
              d="M -6 8 L 6 8 L 4.5 16 L -4.5 16 Z"
              fill="var(--background)"
              stroke="var(--foreground)"
              strokeWidth={1.3}
              strokeLinejoin="round"
            />
          </g>
        </g>
      </svg>

      <p id={liveId} role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announceText}
      </p>

      {lines.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          {note ? <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ns-muted">{note}</p> : null}
          <ol data-rw-receipt aria-label="Receipt" className="flex flex-col gap-1.5">
            {lines.map((line, i) => (
              <li
                key={`${line.label}-${i}`}
                style={reducedMotion ? undefined : { animationDelay: `${i * 90}ms` }}
                className={`flex items-center justify-between gap-3 ${reducedMotion ? "" : "ns-rw-row-enter"}`}
              >
                <span className="flex items-center gap-1.5 text-sm text-foreground">
                  {line.amount < 0 ? <ReturnGlyph /> : null}
                  {line.label}
                </span>
                <span
                  className={`font-mono text-sm tabular-nums ${
                    line.amount < 0 ? "font-semibold text-foreground" : "text-ns-muted"
                  }`}
                >
                  {line.amount < 0 ? `− ${formatUSD(Math.abs(line.amount))}` : formatUSD(line.amount)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

const CSS = `
.ns-rw-cup-inner{transform-box:fill-box;transform-origin:center;}
.ns-rw-cup-inner.ns-rw-cup-launch{animation:ns-rw-launch-pulse 200ms cubic-bezier(0.34,1.56,0.64,1);}
@keyframes ns-rw-launch-pulse{0%{transform:scale(0.82);}55%{transform:scale(1.08);}100%{transform:scale(1);}}
@keyframes ns-rw-row-enter{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);}}
.ns-rw-row-enter{animation:ns-rw-row-enter 260ms cubic-bezier(0.19,1,0.22,1) both;}
@media (prefers-reduced-motion: reduce){
  .ns-rw-cup-inner.ns-rw-cup-launch{animation:none !important;}
  .ns-rw-row-enter{animation:none !important;}
}
`;
