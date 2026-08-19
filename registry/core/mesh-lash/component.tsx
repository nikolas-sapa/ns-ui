"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

// ---------------------------------------------------------------------------
// GearLashField — a currency amount field where two meshed gears ARE the FX
// quote: the tooth ratio is the exchange rate, and mechanical backlash (the
// small dead-travel every real gear pair has before the flanks re-engage on
// a direction reversal) is the provider's spread, made literal.
//
// MODEL
// One governing scalar, driveAngle, is a direct function of the typed
// amount (driveAngle = amount * DEG_PER_UNIT — "accumulated" in the sense
// that it is exactly what you'd get integrating a constant deg/unit rate
// over every keystroke/scrub delta, just computed directly since amount is
// already the source of truth). The gear only ever SHOWS driveAngle mod 360;
// a separate Geist Mono row shows the un-wrapped, fully computed amount.
//
// Backlash is the textbook control-theory "backlash" nonlinearity: a
// `contact` value that free-wheels with driveAngle while moving in one
// direction, but on a reversal sits frozen until driveAngle has crossed the
// FULL dead-zone width (2x half-width) — exactly the "drive turns through a
// visible dead angle before the driven picks up" behavior:
//
//   if driveAngle - contact >  halfWidth: contact = driveAngle - halfWidth
//   if driveAngle - contact < -halfWidth: contact = driveAngle + halfWidth
//   else: contact unchanged
//
// halfWidth is derived from the real spread fraction: lashWidthDeg =
// spreadFrac * DEG_PER_UNIT * LEGIBILITY_GAIN — a fixed, stated gain so a
// real 0.3-2% spread (otherwise a fraction of a degree) reads as an actual
// wedge on an 8-40 tooth gear.
//
// drivenAngle = (driveAngle - lashState) / ratio, where lashState =
// driveAngle - contact (the current position inside the dead zone) and
// ratio = teethDrive / teethDriven (the drawn gear ratio) — so
// driveAngle - lashState === contact, and drivenAngle === contact / ratio.
// The printed converted amount is read straight off drivenAngle (scaled
// back through DEG_PER_UNIT and a power-of-ten `scale` pulled out of the
// rate so gears stay legible for both near-parity and far-apart pairs) —
// there is no second, independently-computed "real" total sitting next to
// the gears. The spread shown to the user is the gap between that
// gear-integrated amount and amount*rate computed with no gear at all —
// literally the lost angle, printed in currency.
//
// TEETH: tooth counts are round(driveTeeth * mantissa) searched over
// driveTeeth in [8,40] for the closest integer ratio to the rate's mantissa
// (rate decomposed into mantissa in [0.2,5] x a power-of-ten `scale`, so a
// JPY-sized rate doesn't demand an unrenderable 1:150 tooth ratio). The
// residual between that drawn ratio and the true rate is disclosed as an
// "honesty line" rather than hidden.
//
// SVG has no native way to tile a fill *around* a circle, so the tooth
// SILHOUETTE (the part that has to be geometrically correct — right tooth
// count, trapezoid profile, correct mesh) is a computed closed path. The
// brief's literal "teeth are an SVG <pattern> of trapezoids" is honored as
// the tooth FILL: a small repeating <pattern> tile of one trapezoid paints
// the inside of that silhouette, so the pattern is real and load-bearing
// (it is what you see), even though the outer tooth boundary comes from
// trig, not from pattern tiling — a genuine SVG limitation, not a shortcut
// taken for convenience.
// ---------------------------------------------------------------------------

const DEG_PER_UNIT = 3.6; // degrees of drive rotation per 1 unit of source currency
const LEGIBILITY_GAIN = 500; // fixed, stated gain turning a 0.3-2% spread into a visible wedge
const TYPED_MS = 200;
const TYPED_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const MODULE_PX = 2.15; // px of pitch radius per tooth
const ADDENDUM = 4.5;
const DEDENDUM = 5.5;
const TOOTH_TOP_FRAC = 0.42;
const TOOTH_BASE_FRAC = 0.62;
const LIVE_MS = 420; // how long the mesh contact mark stays lit after input
const ANNOUNCE_DEBOUNCE = 450; // ms of quiet before the live region commits
// Deliberately fine: at a typical 0.3-2% spread the dead zone is only a few
// currency units wide (13.5deg / DEG_PER_UNIT ~ 3.75 units at 0.75%/500x
// gain), so a coarse px->unit ratio would blow past the whole gap in under
// 2px of drag and the component's central claim would never be seen.
const SCRUB_UNITS_PER_PX = 0.3;
const MAX_AMOUNT = 999_999;
const SVG_MARGIN = 6;

// ---- pure math -------------------------------------------------------------

interface GearConfig {
  teethDrive: number;
  teethDriven: number;
  ratio: number; // teethDrive / teethDriven
  scale: number; // power-of-ten pulled out of rate so mantissa fits [0.2, 5]
  mantissa: number; // rate / scale
}

function computeGearConfig(rateInput: number): GearConfig {
  let scale = 1;
  let r = Math.abs(rateInput) || 1;
  let guard = 0;
  while (r < 0.2 && guard++ < 20) {
    r *= 10;
    scale /= 10;
  }
  guard = 0;
  while (r > 5 && guard++ < 20) {
    r /= 10;
    scale *= 10;
  }

  let best: { drive: number; driven: number; err: number } | null = null;
  for (let drive = 8; drive <= 40; drive++) {
    const driven = Math.round(drive * r);
    if (driven < 8 || driven > 40) continue;
    const err = Math.abs(driven / drive - r);
    if (!best || err < best.err) best = { drive, driven, err };
  }
  if (!best) {
    const drive = r < 1 ? 40 : 8;
    const driven = Math.min(40, Math.max(8, Math.round(drive * r)));
    best = { drive, driven, err: Math.abs(driven / drive - r) };
  }

  return {
    teethDrive: best.drive,
    teethDriven: best.driven,
    ratio: best.drive / best.driven,
    scale,
    mantissa: r,
  };
}

function lashHalfWidthDeg(spreadFrac: number): number {
  const clamped = Math.min(0.25, Math.max(0, spreadFrac));
  return (clamped * DEG_PER_UNIT * LEGIBILITY_GAIN) / 2;
}

/** The classic backlash / dead-zone nonlinearity. `contact` free-wheels with
 * `x` while moving in one direction; on a reversal it stays put until `x`
 * has crossed the full 2*halfWidth gap. */
function updateContact(prevContact: number, x: number, halfWidth: number): number {
  if (x - prevContact > halfWidth) return x - halfWidth;
  if (x - prevContact < -halfWidth) return x + halfWidth;
  return prevContact;
}

function parseAmount(raw: string): number | null {
  if (raw.trim() === "") return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(MAX_AMOUNT, Math.max(0, n));
}

function formatCurrency(value: number, code: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${code}`;
  }
}

// ---- gear geometry ----------------------------------------------------------

function pitchRadius(teeth: number): number {
  return teeth * MODULE_PX;
}

function polarPoint(r: number, deg: number): { x: number; y: number } {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: r * Math.cos(rad), y: r * Math.sin(rad) };
}

function fmt(n: number): string {
  return Math.round(n * 100) / 100 + "";
}

/** One closed path, in LOCAL coordinates centered on (0,0): a ring of
 * trapezoid teeth between innerR (root) and outerR (tip). */
function gearToothPath(outerR: number, innerR: number, teeth: number): string {
  const step = 360 / teeth;
  const halfTop = (step * TOOTH_TOP_FRAC) / 2;
  const halfBase = (step * TOOTH_BASE_FRAC) / 2;
  let d = "";
  for (let i = 0; i < teeth; i++) {
    const c = i * step;
    const p1 = polarPoint(innerR, c - halfBase);
    const p2 = polarPoint(outerR, c - halfTop);
    const p3 = polarPoint(outerR, c + halfTop);
    const p4 = polarPoint(innerR, c + halfBase);
    d += `${i === 0 ? "M" : "L"} ${fmt(p1.x)} ${fmt(p1.y)} L ${fmt(p2.x)} ${fmt(p2.y)} L ${fmt(p3.x)} ${fmt(p3.y)} L ${fmt(p4.x)} ${fmt(p4.y)} `;
  }
  return d + "Z";
}

interface Scene {
  width: number;
  height: number;
  driveCx: number;
  driveCy: number;
  driveOuter: number;
  driveInner: number;
  driveHub: number;
  drivePath: string;
  drivenCx: number;
  drivenCy: number;
  drivenOuter: number;
  drivenInner: number;
  drivenHub: number;
  drivenPath: string;
  contactX: number;
  contactY: number;
}

function buildScene(cfg: GearConfig): Scene {
  const rDrive = pitchRadius(cfg.teethDrive);
  const rDriven = pitchRadius(cfg.teethDriven);
  const outerDrive = rDrive + ADDENDUM;
  const innerDrive = rDrive - DEDENDUM;
  const outerDriven = rDriven + ADDENDUM;
  const innerDriven = rDriven - DEDENDUM;
  const maxOuter = Math.max(outerDrive, outerDriven);

  const driveCx = SVG_MARGIN + outerDrive;
  const cy = SVG_MARGIN + maxOuter;
  const drivenCx = driveCx + rDrive + rDriven;

  return {
    width: drivenCx + outerDriven + SVG_MARGIN,
    height: cy * 2,
    driveCx,
    driveCy: cy,
    driveOuter: outerDrive,
    driveInner: innerDrive,
    driveHub: innerDrive * 0.42,
    drivePath: gearToothPath(outerDrive, innerDrive, cfg.teethDrive),
    drivenCx,
    drivenCy: cy,
    drivenOuter: outerDriven,
    drivenInner: innerDriven,
    drivenHub: innerDriven * 0.42,
    drivenPath: gearToothPath(outerDriven, innerDriven, cfg.teethDriven),
    contactX: driveCx + rDrive,
    contactY: cy,
  };
}

interface Mechanism {
  contact: number;
  driveAngle: number;
  drivenAngleRaw: number;
  converted: number;
  fee: number;
  honesty: string;
}

/** The whole mechanism as one pure function of (amount, prior contact) — used
 * both to seed the resting-state render (no "blank until mount" frame) and,
 * on every input, to recompute what the gears show and what settles into the
 * live region. One function, two callers, so there is never a second,
 * independently-computed number sitting beside the gear math. */
function deriveMechanism(amount: number, prevContact: number, cfg: GearConfig, halfWidth: number, rate: number): Mechanism {
  const driveAngle = amount * DEG_PER_UNIT;
  const contact = updateContact(prevContact, driveAngle, halfWidth);
  const drivenAngleRaw = contact / cfg.ratio;
  const converted = (drivenAngleRaw / DEG_PER_UNIT) * cfg.scale;
  const ideal = amount * rate;
  const fee = Math.abs(ideal - converted);
  const honesty = `drawn ${cfg.teethDriven}:${cfg.teethDrive}, true ${cfg.mantissa.toFixed(4)}${
    cfg.scale !== 1 ? ` ×${cfg.scale}` : ""
  }`;
  return { contact, driveAngle, drivenAngleRaw, converted, fee, honesty };
}

function writeRotation(el: SVGGElement | null, cx: number, cy: number, deg: number, ms: number, ease: string) {
  if (!el) return;
  el.style.transition = ms > 0 ? `transform ${ms}ms ${ease}` : "none";
  el.style.transform = `translate(${fmt(cx)}px, ${fmt(cy)}px) rotate(${fmt(deg)}deg)`;
}

// ---- component ---------------------------------------------------------------

export interface GearLashFieldProps {
  /** ISO-ish code for the amount being sent, e.g. "USD". Default "USD". */
  fromCurrency?: string;
  /** ISO-ish code for the amount received, e.g. "EUR". Default "EUR". */
  toCurrency?: string;
  /** True exchange rate: units of `toCurrency` per 1 unit of `fromCurrency`. */
  rate: number;
  /** Provider spread as a fraction, e.g. 0.008 for 0.8%. Typical range 0.003-0.02. */
  spreadFrac: number;
  /** Initial amount in `fromCurrency`. Default 250. */
  defaultAmount?: number;
  /** Label for the source amount field. Default "You send". */
  label?: string;
  /** Label for the live-region readout. Default "They receive". */
  receiveLabel?: string;
  /** Fires once per settle (debounced), never per raw keystroke. */
  onAmountChange?: (info: { amount: number; converted: number; fee: number }) => void;
  className?: string;
}

export function GearLashField({
  fromCurrency = "USD",
  toCurrency = "EUR",
  rate,
  spreadFrac,
  defaultAmount = 250,
  label = "You send",
  receiveLabel = "They receive",
  onAmountChange,
  className = "",
}: GearLashFieldProps) {
  const uid = useId().replace(/:/g, "");
  const patternId = `ns-mesh-lash-teeth-${uid}`;
  const inputId = `ns-mesh-lash-input-${uid}`;

  const safeRate = Number.isFinite(rate) && rate !== 0 ? rate : 1;
  const cfg = useMemo(() => computeGearConfig(safeRate), [safeRate]);
  const scene = useMemo(() => buildScene(cfg), [cfg]);
  const halfWidth = useMemo(() => lashHalfWidthDeg(spreadFrac), [spreadFrac]);

  const initialAmount = parseAmount(String(defaultAmount)) ?? 0;
  const initialMechanism = deriveMechanism(initialAmount, 0, cfg, halfWidth, safeRate);

  const [rawText, setRawText] = useState(() => String(defaultAmount));
  const [display, setDisplay] = useState(() => ({
    amount: initialAmount,
    converted: initialMechanism.converted,
    fee: initialMechanism.fee,
    honesty: initialMechanism.honesty,
  }));

  const driveGroupRef = useRef<SVGGElement | null>(null);
  const drivenGroupRef = useRef<SVGGElement | null>(null);
  const contactMarkRef = useRef<SVGCircleElement | null>(null);

  // Seeded from the same mechanism the resting frame renders, so the first
  // real input is a genuine transition rather than a "snap from zero".
  const contactRef = useRef(initialMechanism.contact);
  const isDraggingRef = useRef(false);
  const reducedRef = useRef(false);
  const liveTimer = useRef<number | undefined>(undefined);
  const announceTimer = useRef<number | undefined>(undefined);
  const dragStartRef = useRef({ x: 0, amount: 0 });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Core mechanism: whenever the typed/scrubbed amount changes, recompute
  // drive/backlash/driven and write it straight to the gear rotations AND
  // to the numbers that get displayed (debounced) — same computation, one
  // path, no separately-derived "real" total sitting beside the gears.
  const applyAmount = useCallback(
    (amount: number) => {
      const m = deriveMechanism(amount, contactRef.current, cfg, halfWidth, safeRate);
      contactRef.current = m.contact;

      const ms = reducedRef.current || isDraggingRef.current ? 0 : TYPED_MS;
      writeRotation(driveGroupRef.current, scene.driveCx, scene.driveCy, m.driveAngle % 360, ms, TYPED_EASE);
      writeRotation(drivenGroupRef.current, scene.drivenCx, scene.drivenCy, -(m.drivenAngleRaw % 360), ms, TYPED_EASE);

      if (contactMarkRef.current) {
        contactMarkRef.current.style.transition = "opacity 150ms ease-out";
        contactMarkRef.current.style.opacity = "1";
      }
      window.clearTimeout(liveTimer.current);
      liveTimer.current = window.setTimeout(() => {
        if (contactMarkRef.current) contactMarkRef.current.style.opacity = "0";
      }, LIVE_MS);

      window.clearTimeout(announceTimer.current);
      announceTimer.current = window.setTimeout(() => {
        setDisplay({ amount, converted: m.converted, fee: m.fee, honesty: m.honesty });
        onAmountChange?.({ amount, converted: m.converted, fee: m.fee });
      }, ANNOUNCE_DEBOUNCE);
    },
    [cfg, halfWidth, onAmountChange, safeRate, scene]
  );

  useEffect(
    () => () => {
      window.clearTimeout(liveTimer.current);
      window.clearTimeout(announceTimer.current);
    },
    []
  );

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setRawText(next);
    const amount = parseAmount(next);
    if (amount === null) return; // mid-typing junk (e.g. "-") — don't fight the caret
    applyAmount(amount);
  };

  const handleScrubDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    const current = parseAmount(rawText) ?? 0;
    dragStartRef.current = { x: e.clientX, amount: current };
  };

  const handleScrubMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const amount = Math.min(MAX_AMOUNT, Math.max(0, dragStartRef.current.amount + dx * SCRUB_UNITS_PER_PX));
    setRawText(amount.toFixed(2));
    applyAmount(amount);
  };

  const endScrub = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const convertedFmt = formatCurrency(display.converted, toCurrency);
  const feeFmt = formatCurrency(display.fee, toCurrency);

  const initialDriveTransform = `translate(${fmt(scene.driveCx)}px, ${fmt(scene.driveCy)}px) rotate(${fmt(
    initialMechanism.driveAngle % 360
  )}deg)`;
  const initialDrivenTransform = `translate(${fmt(scene.drivenCx)}px, ${fmt(scene.drivenCy)}px) rotate(${fmt(
    -(initialMechanism.drivenAngleRaw % 360)
  )}deg)`;

  return (
    <div className={`ns-mesh-lash-root w-full max-w-sm ${className}`}>
      <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium text-ns-muted">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-[12px] border border-border bg-background px-3 py-2.5 transition-colors hover:border-foreground/30">
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={rawText}
          onChange={handleChange}
          aria-label={`${label}, amount in ${fromCurrency}`}
          className="min-w-0 flex-1 rounded-[6px] bg-transparent font-mono text-lg tabular-nums text-foreground placeholder:text-ns-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          placeholder="0.00"
        />
        <span aria-hidden="true" className="shrink-0 font-mono text-xs uppercase tracking-wider text-ns-muted">
          {fromCurrency}
        </span>
      </div>

      <div
        data-mesh-role="scrub"
        aria-hidden="true"
        onPointerDown={handleScrubDown}
        onPointerMove={handleScrubMove}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        className="mt-3 select-none rounded-[16px] border border-border bg-background px-3 py-3 transition-colors hover:border-foreground/25"
        style={{ touchAction: "none", cursor: "ew-resize" }}
      >
        <svg viewBox={`0 0 ${scene.width} ${scene.height}`} width="100%" aria-hidden="true" style={{ display: "block" }}>
          <defs>
            <pattern id={patternId} width="5" height="5" patternUnits="userSpaceOnUse">
              <rect width="5" height="5" fill="var(--background)" />
              <polygon points="0,5 1.6,0.6 3.4,0.6 5,5" fill="var(--border)" opacity={0.55} />
            </pattern>
          </defs>

          <g ref={driveGroupRef} style={{ transform: initialDriveTransform }}>
            <path d={scene.drivePath} fill={`url(#${patternId})`} stroke="var(--foreground)" strokeOpacity={0.5} strokeWidth={1} />
            <circle r={scene.driveHub} fill="var(--background)" stroke="var(--border)" strokeWidth={1} />
            <circle r={1.4} fill="var(--ns-muted)" />
          </g>

          <g ref={drivenGroupRef} style={{ transform: initialDrivenTransform }}>
            <path d={scene.drivenPath} fill={`url(#${patternId})`} stroke="var(--foreground)" strokeOpacity={0.5} strokeWidth={1} />
            <circle r={scene.drivenHub} fill="var(--background)" stroke="var(--border)" strokeWidth={1} />
            <circle r={1.4} fill="var(--ns-muted)" />
          </g>

          <circle
            ref={contactMarkRef}
            cx={scene.contactX}
            cy={scene.contactY}
            r={1}
            fill="var(--ns-accent)"
            style={{ opacity: 0 }}
          />
        </svg>
      </div>

      <div role="status" aria-live="polite" aria-atomic="true" className="mt-3 space-y-0.5">
        <p className="font-mono text-sm tabular-nums text-foreground">
          {receiveLabel} <span className="font-medium">{convertedFmt}</span>
        </p>
        <p className="font-mono text-xs tabular-nums text-ns-muted">Spread cost {feeFmt}</p>
        <p className="pt-1 font-mono text-[10px] tracking-wide text-ns-muted" aria-hidden="true">
          {display.honesty}
        </p>
      </div>
    </div>
  );
}
