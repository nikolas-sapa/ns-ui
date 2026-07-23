"use client";

import { Fragment, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// CarryDigit — a live numeric readout where change animates the way
// arithmetic works. Digits are diffed right-to-left against place value
// (ones, tens, hundreds, ...), never by string index, so a value that grows
// a digit (999 -> 1000) still lines every existing digit up with its own
// place. Only the digits that actually differ move; a carry chain (199 ->
// 200) ripples right-to-left, each column starting STEP_MS after the one to
// its right, so the eye can follow the carry travel instead of seeing the
// whole readout flash at once. A new leading digit grows its own column
// width in from 0 (a FLIP-style entrance) instead of shoving the row over in
// one frame; a column that stops existing (1000 -> 999) shrinks the same way
// before it's dropped from the DOM.
//
// Motion is a CSS transition tuned to the requested spring (mass 1,
// stiffness 300, zeta ~0.6): for a 2nd-order step response that pair gives
// ~9.5% overshoot and a ~380ms settle (exp(-zeta*pi/sqrt(1-zeta^2)) at
// zeta=0.6), which is what cubic-bezier(0.34, 1.56, 0.64, 1) over 380ms
// approximates — on a ~1.15em row that overshoot reads as the ~2px hop.
// Per-column stagger rides the browser's own `transition-delay`, so there is
// no JS timer per column, just one batch timeout to settle the whole row.
// ---------------------------------------------------------------------------

const STEP_MS = 40; // per-column ripple stagger
const DURATION = 380; // ms — settle time of the (k=300, zeta=0.6) spring
const SPRING_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const ROW = "1.15em"; // one digit row's clipped height
const ANNOUNCE_DEBOUNCE = 500; // ms of quiet before the settled value is read

type Phase = "idle" | "enter" | "exit" | "flip";

interface Col {
  place: number; // 10^place; negative = fractional digits
  char: string;
  fromChar?: string; // only set while phase === "flip"
  phase: Phase;
  dir: 1 | -1;
  delay: number;
}

interface Parts {
  intPart: string;
  fracPart: string;
}

function toParts(value: number, decimals: number): Parts {
  const abs = Math.abs(value);
  const fixed = decimals > 0 ? abs.toFixed(decimals) : String(Math.round(abs));
  const [intPart, fracPart = ""] = fixed.split(".");
  return { intPart: intPart || "0", fracPart };
}

function charMap(parts: Parts): Map<number, string> {
  const m = new Map<number, string>();
  for (let k = 0; k < parts.intPart.length; k++) {
    m.set(parts.intPart.length - 1 - k, parts.intPart[k]);
  }
  for (let k = 0; k < parts.fracPart.length; k++) {
    m.set(-(k + 1), parts.fracPart[k]);
  }
  return m;
}

function buildIdleCols(value: number, decimals: number): Col[] {
  const parts = toParts(value, decimals);
  const map = charMap(parts);
  const minPlace = decimals > 0 ? -decimals : 0;
  const maxPlace = parts.intPart.length - 1;
  const cols: Col[] = [];
  for (let p = maxPlace; p >= minPlace; p--) {
    cols.push({ place: p, char: map.get(p) ?? "0", phase: "idle", dir: 1, delay: 0 });
  }
  return cols;
}

function srText(value: number, decimals: number, label?: string): string {
  const formatted =
    decimals > 0
      ? value.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : Math.round(value).toLocaleString();
  return label ? `${label}: ${formatted}` : formatted;
}

export interface CarryDigitProps {
  /** the number to display; every render diffs against the previous value */
  value: number;
  /** fixed count of fractional digits (0 = integers only) */
  decimals?: number;
  /** visible caption above the readout, also prefixed onto the SR announcement */
  label?: string;
  className?: string;
}

function DigitCell({ col, armed }: { col: Col; armed: boolean }) {
  if (col.phase === "idle") {
    return (
      <span
        aria-hidden
        className="inline-block w-[1ch] shrink-0 overflow-hidden text-center align-baseline"
        style={{ height: ROW, lineHeight: ROW }}
      >
        {col.char}
      </span>
    );
  }

  if (col.phase === "enter" || col.phase === "exit") {
    // enter: hidden -> full width/opacity once armed. exit: full -> hidden.
    const shown = col.phase === "enter" ? armed : !armed;
    return (
      <span
        aria-hidden
        className="inline-block shrink-0 overflow-hidden text-center align-baseline"
        style={{
          height: ROW,
          lineHeight: ROW,
          width: shown ? "1ch" : "0ch",
          opacity: shown ? 1 : 0,
          transition: `width ${DURATION}ms ${SPRING_EASE} ${col.delay}ms, opacity ${DURATION}ms ease-out ${col.delay}ms`,
        }}
      >
        {col.char}
      </span>
    );
  }

  // flip: a two-row track clipped to one row; sliding it by one row height
  // swaps which glyph shows. dir=1 (value increased) scrolls the old glyph
  // up and out, the new one up and in from below; dir=-1 mirrors it.
  const from = col.fromChar ?? col.char;
  const rows = col.dir === 1 ? [from, col.char] : [col.char, from];
  const restY = col.dir === 1 ? "0" : `-${ROW}`;
  const playY = col.dir === 1 ? `-${ROW}` : "0";
  return (
    <span
      aria-hidden
      className="relative inline-block w-[1ch] shrink-0 overflow-hidden align-baseline"
      style={{ height: ROW, lineHeight: ROW }}
    >
      {/* Invisible in-flow glyph, same char/metrics as the idle cells. The
          sliding track right below is the only OTHER child and it's
          position:absolute — out-of-flow children are skipped when a flex
          container hunts for an item's baseline, so without this the flip
          cell has no in-flow baseline content and the browser synthesizes
          its bottom margin edge as the baseline instead of the text
          baseline every idle/enter/exit cell uses.
          `lineHeight: ROW` on THIS outer span (not just the anchor below) is
          just as load-bearing: an inline-block's own flex-baseline is struck
          from its own computed line-height, inherited as "normal" here if
          unset, not from a descendant's. With only the anchor carrying ROW,
          the anchor's line box and the outer box's own strut disagreed by a
          few px (measured ~3px at text-3xl/Geist Mono) — invisible on a
          lone flip next to nothing, but every simultaneously-flipping
          column in a big carry (e.g. 999->1000, all four columns at once)
          carried the same offset, so the whole readout visibly hopped
          vertically together, snapping back at settle. Both this span's own
          `lineHeight` and the anchor's must be ROW for the flip cell's
          baseline to land exactly where idle/enter/exit put theirs. */}
      <span className="invisible" style={{ lineHeight: ROW }}>
        {col.char}
      </span>
      <span
        className="absolute inset-x-0 top-0 flex flex-col will-change-transform"
        style={{
          transform: `translateY(${armed ? playY : restY})`,
          transition: armed ? `transform ${DURATION}ms ${SPRING_EASE} ${col.delay}ms` : "none",
        }}
      >
        <span className="flex items-center justify-center" style={{ height: ROW, lineHeight: ROW }}>
          {rows[0]}
        </span>
        <span className="flex items-center justify-center" style={{ height: ROW, lineHeight: ROW }}>
          {rows[1]}
        </span>
      </span>
    </span>
  );
}

export function CarryDigit({ value, decimals = 0, label, className = "" }: CarryDigitProps) {
  const [cols, setCols] = useState<Col[]>(() => buildIdleCols(value, decimals));
  const [armed, setArmed] = useState(false);
  const prevValueRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const settleTimer = useRef<number | undefined>(undefined);
  const armRaf = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(settleTimer.current);

    if (!mountedRef.current) {
      mountedRef.current = true;
      prevValueRef.current = value;
      setCols(buildIdleCols(value, decimals));
      setArmed(false);
      return;
    }

    const prevValue = prevValueRef.current ?? value;
    prevValueRef.current = value;
    if (prevValue === value) return; // no-op update: nothing to animate

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dir: 1 | -1 = value > prevValue ? 1 : -1;

    const prevParts = toParts(prevValue, decimals);
    const nextParts = toParts(value, decimals);
    const prevChar = charMap(prevParts);
    const nextChar = charMap(nextParts);

    const minPlace = decimals > 0 ? -decimals : 0;
    const maxPlace = Math.max(nextParts.intPart.length - 1, prevParts.intPart.length - 1);

    const allPlaces: number[] = [];
    for (let p = maxPlace; p >= minPlace; p--) allPlaces.push(p);

    const changedPlaces = allPlaces.filter((p) => nextChar.get(p) !== prevChar.get(p));
    const minChanged = changedPlaces.length ? Math.min(...changedPlaces) : 0;

    const nextCols: Col[] = allPlaces
      .filter((p) => nextChar.has(p) || prevChar.has(p))
      .map((p): Col => {
        const has = nextChar.has(p);
        const had = prevChar.has(p);
        const delay = Math.max(0, STEP_MS * (p - minChanged));
        if (has && !had) {
          return { place: p, char: nextChar.get(p)!, phase: "enter", dir, delay };
        }
        if (!has && had) {
          return { place: p, char: prevChar.get(p)!, phase: "exit", dir, delay };
        }
        const c = nextChar.get(p)!;
        const prevC = prevChar.get(p)!;
        if (c !== prevC) {
          return { place: p, char: c, fromChar: prevC, phase: "flip", dir, delay };
        }
        return { place: p, char: c, phase: "idle", dir, delay: 0 };
      });

    if (reduced) {
      setCols(nextCols.filter((c) => c.phase !== "exit").map((c) => ({ ...c, phase: "idle", delay: 0 })));
      setArmed(false);
      return;
    }

    setCols(nextCols);
    setArmed(false);
    // Nest two rAFs: setCols/setArmed(false) above haven't painted yet when
    // this effect runs, so a single rAF fires on the SAME upcoming frame as
    // that reset commit and can flip `armed` to true before the browser ever
    // paints the "at rest" (width:0 / transform:restY, transition:none)
    // frame — the reset and the animated target collapse into one frame and
    // the transition never plays (columns pop straight to their final state
    // instead of growing/flipping). Waiting a full extra frame guarantees the
    // reset actually painted before we arm the transition.
    if (armRaf.current !== undefined) cancelAnimationFrame(armRaf.current);
    armRaf.current = requestAnimationFrame(() => {
      armRaf.current = requestAnimationFrame(() => setArmed(true));
    });

    const maxDelay = nextCols.reduce((m, c) => Math.max(m, c.delay), 0);
    settleTimer.current = window.setTimeout(() => {
      setCols((prev) =>
        prev.filter((c) => c.phase !== "exit").map((c) => ({ ...c, phase: "idle", delay: 0 }))
      );
      setArmed(false);
    }, maxDelay + DURATION + 30);

    return () => {
      if (armRaf.current !== undefined) cancelAnimationFrame(armRaf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals]);

  useEffect(
    () => () => {
      window.clearTimeout(settleTimer.current);
      if (armRaf.current !== undefined) cancelAnimationFrame(armRaf.current);
    },
    []
  );

  // debounced aria-live text: rapid ticks only announce the settled value
  const [announced, setAnnounced] = useState(() => srText(value, decimals, label));
  const announceMounted = useRef(false);
  const announceTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!announceMounted.current) {
      announceMounted.current = true;
      return;
    }
    window.clearTimeout(announceTimer.current);
    announceTimer.current = window.setTimeout(() => {
      setAnnounced(srText(value, decimals, label));
    }, ANNOUNCE_DEBOUNCE);
    return () => window.clearTimeout(announceTimer.current);
  }, [value, decimals, label]);

  const sorted = [...cols].sort((a, b) => b.place - a.place);
  const sign = value < 0 ? "−" : "";

  return (
    <div className={`inline-flex flex-col items-start gap-1.5 ${className}`}>
      {label && (
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">{label}</span>
      )}
      <div role="status" aria-live="polite" aria-atomic="true" className="inline-flex items-baseline">
        <div aria-hidden className="flex items-baseline font-mono text-3xl font-medium tabular-nums text-foreground">
          {sign && <span className="pr-[0.04em]">{sign}</span>}
          {sorted.map((col) => (
            <Fragment key={col.place}>
              {decimals > 0 && col.place === -1 && <span className="px-[0.02em]">.</span>}
              <DigitCell col={col} armed={armed} />
            </Fragment>
          ))}
        </div>
        <span className="sr-only">{announced}</span>
      </div>
    </div>
  );
}
