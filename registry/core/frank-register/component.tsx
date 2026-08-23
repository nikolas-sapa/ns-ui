"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// FrankRegister — a postal franking meter for paying out of a prepaid wallet.
// Committing stamps an indicium (amount / date / serial) onto an invoice
// while two odometer stacks roll: the descending BALANCE register rolls
// down by exactly the paid amount, the ascending SPENT register rolls up by
// the same amount. The two are never tracked as independent numbers — spent
// is *derived* as (creditsPurchased - balance) every render, so the
// reconciliation invariant (balance + spent === creditsPurchased) holds by
// construction, not by hoping two separately-animated counters stay in
// sync. One `commit(amountCents)` call is the single governing scalar that
// feeds the balance delta, the frank's printed amount, and the die-drop
// trigger — one gear train, not three independent tweens.
//
// ODOMETER MECHANISM: each digit column is a vertically clipped cell over a
// 30-row strip of the sequence 0..9 repeated three times (indices 0-29).
// The "home" band is indices 10-19, where index (10+d) shows digit d. A
// commit computes, per column, a `rest` row (home row for the old digit),
// a `play` row (home row for the new digit, OVERSHOT by +10 if the digit
// wrapped forward, or UNDERSHOT by -10 if it wrapped backward), and a
// `final` row (home row for the new digit, always back in 10-19). The cell
// renders at `rest` while unarmed and `play` once armed, transitioning
// over 400ms; once the transition settles, state snaps instantly (no
// transition) from `play` to `final` — a jump of exactly one strip period,
// so the same digit is on screen before and after and the cut is
// invisible. Because the ascending register's row only ever climbs and the
// descending register's row only ever falls, the two wheel families spin
// in opposite senses from the same 400ms drive — mechanically mirrored,
// not two unrelated tweens. Carries stagger 40ms per column, right-to-left
// (rightmost changed place first), computed the same way as this
// registry's counter-carry-ripple digit diffing, but the visual here is a
// continuous odometer roll, never a single flipped glyph.
//
// Pure DOM + SVG + CSS, no canvas. All ink is token-relative (--background,
// --foreground, --ns-muted, --border; --ns-accent only for the keyboard
// focus ring). Reduced motion snaps every wheel straight to its final
// digit and the die never travels.
// ---------------------------------------------------------------------------

const ROW_EM = 1.15; // one digit row's clipped height
const STRIP_LEN = 30; // three full 0-9 cycles; home band is 10-19
const HOME = 10;
const STRIP = Array.from({ length: STRIP_LEN }, (_, i) => String(i % 10));

const ROLL_MS = 400; // wheel roll duration (one gear train, both registers)
const STAGGER_MS = 40; // per-column carry stagger, right-to-left
const ROLL_EASE = "cubic-bezier(0.65, 0, 0.35, 1)"; // mechanical, not springy

const DIE_DROP_MS = 140;
const DIE_DWELL_MS = 120;
const DIE_RETURN_MS = 180;
const DIE_DROP_EASE = "cubic-bezier(0.16, 1, 0.3, 1)"; // ease-out-expo
const PRESS_MS = 90; // frank's one-frame press-darken

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

// ---------------------------------------------------------------------------
// money helpers — everything animatable is tracked in integer cents so
// repeated commits can never drift from float rounding.
// ---------------------------------------------------------------------------

function toCents(dollars: number): number {
  return Math.round(Math.max(0, dollars) * 100);
}

function fmt(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function digitAt(cents: number, place: number): number {
  if (place >= 0) {
    const dollars = Math.floor(cents / 100);
    return Math.floor(dollars / 10 ** place) % 10;
  }
  const frac = cents % 100;
  return place === -1 ? Math.floor(frac / 10) % 10 : frac % 10;
}

function formatFrankDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  return `${day} ${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

// ---------------------------------------------------------------------------
// wheel column model
// ---------------------------------------------------------------------------

interface Col {
  place: number;
  rest: number;
  play: number;
  final: number;
  delay: number;
}

function idleCols(cents: number, places: number[]): Col[] {
  return places.map((place) => {
    const row = HOME + digitAt(cents, place);
    return { place, rest: row, play: row, final: row, delay: 0 };
  });
}

// `dir` fixes which way THIS register is allowed to wrap: "asc" only ever
// carries forward (9 -> 0), "desc" only ever borrows backward (0 -> 9) —
// true for any single addition/subtraction of one amount, which is all a
// single commit ever does.
function commitCols(prevCents: number, nextCents: number, places: number[], dir: "asc" | "desc"): Col[] {
  const changed = places.filter((p) => digitAt(prevCents, p) !== digitAt(nextCents, p));
  const minChanged = changed.length ? Math.min(...changed) : 0;

  return places.map((place) => {
    const d0 = digitAt(prevCents, place);
    const d1 = digitAt(nextCents, place);
    const rest = HOME + d0;
    const final = HOME + d1;
    let play = final;
    if (dir === "asc" && d1 < d0) play = final + STRIP_LEN / 3; // overshoot: carried through 9->0
    if (dir === "desc" && d1 > d0) play = final - STRIP_LEN / 3; // undershoot: borrowed through 0->9
    const delay = changed.includes(place) ? STAGGER_MS * (place - minChanged) : 0;
    return { place, rest, play, final, delay };
  });
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

function WheelRow({ cols, armed }: { cols: Col[]; armed: boolean }) {
  return (
    <div aria-hidden="true" className="ns-fr-wheel">
      {cols.map((col) => {
        const row = armed ? col.play : col.rest;
        return (
          <span key={col.place} className="ns-fr-wcell">
            <span
              className="ns-fr-wtrack"
              style={{
                transform: `translateY(-${(row * ROW_EM).toFixed(3)}em)`,
                transition: armed
                  ? `transform ${ROLL_MS}ms ${ROLL_EASE} ${col.delay}ms`
                  : "none",
              }}
            >
              {STRIP.map((d, i) => (
                <span key={i} className="ns-fr-wdigit">
                  {d}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface FrankRegisterProps {
  /** total credits ever purchased for this wallet — the reconciliation invariant: balance + spent always equals this. */
  creditsPurchased: number;
  /** current balance; supplying this makes the component controlled (pair with onCommit). */
  balance?: number;
  /** starting balance when uncontrolled. @default creditsPurchased */
  defaultBalance?: number;
  /** the amount debited on each commit. */
  amount: number;
  /** what the charge is for, printed above the amount. */
  description?: string;
  /** verb on the commit button, e.g. "Charge" or "Pay". @default "Charge" */
  actionLabel?: string;
  /** fires once a commit lands, with the amount paid and the resulting balance (both in dollars). */
  onCommit?: (amount: number, nextBalance: number) => void;
  /** extra classes merged onto the root element. */
  className?: string;
}

interface Frank {
  amountCents: number;
  date: string;
  serial: string;
}

export function FrankRegister({
  creditsPurchased,
  balance,
  defaultBalance,
  amount,
  description,
  actionLabel = "Charge",
  onCommit,
  className = "",
}: FrankRegisterProps) {
  const creditsCents = toCents(creditsPurchased);
  const isControlled = balance !== undefined;
  const [internalCents, setInternalCents] = useState(() =>
    Math.min(creditsCents, toCents(defaultBalance ?? creditsPurchased))
  );
  const balanceCents = Math.min(
    creditsCents,
    isControlled ? toCents(balance as number) : internalCents
  );
  const spentCents = creditsCents - balanceCents; // derived, not tracked — the invariant can't drift

  if (process.env.NODE_ENV !== "production") {
    console.assert(
      balanceCents + spentCents === creditsCents,
      "frank-register: descending + ascending registers do not reconcile with creditsPurchased"
    );
  }

  const amountCents = toCents(amount);
  const canCommit = amountCents > 0 && amountCents <= balanceCents;

  const intDigits = Math.max(4, String(Math.floor(creditsCents / 100)).length);
  const places = [...Array.from({ length: intDigits }, (_, i) => intDigits - 1 - i), -1, -2];

  const reducedMotion = useReducedMotion();

  const [descCols, setDescCols] = useState<Col[]>(() => idleCols(balanceCents, places));
  const [ascCols, setAscCols] = useState<Col[]>(() => idleCols(spentCents, places));
  const [armed, setArmed] = useState(false);
  const prevBalanceRef = useRef(balanceCents);
  const settleTimer = useRef<number | undefined>(undefined);
  const armRaf = useRef<number | undefined>(undefined);
  const mountedRef = useRef(false);

  useLayoutEffect(() => {
    const prevBalance = prevBalanceRef.current;
    prevBalanceRef.current = balanceCents;

    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (prevBalance === balanceCents) return;

    window.clearTimeout(settleTimer.current);
    if (armRaf.current !== undefined) cancelAnimationFrame(armRaf.current);

    const prevSpent = creditsCents - prevBalance;

    if (reducedMotion) {
      setDescCols(idleCols(balanceCents, places));
      setAscCols(idleCols(spentCents, places));
      setArmed(false);
      return;
    }

    const nextDesc = commitCols(prevBalance, balanceCents, places, "desc");
    const nextAsc = commitCols(prevSpent, spentCents, places, "asc");
    setDescCols(nextDesc);
    setAscCols(nextAsc);
    setArmed(false);

    // two rAFs: the reset above hasn't painted yet this frame, so arming on
    // the very next rAF can collapse the "rest" and "play" frames into one
    // and skip the transition. waiting an extra frame guarantees the rest
    // pose actually painted before the transition is armed.
    armRaf.current = requestAnimationFrame(() => {
      armRaf.current = requestAnimationFrame(() => setArmed(true));
    });

    const maxDelay = Math.max(
      0,
      ...nextDesc.map((c) => c.delay),
      ...nextAsc.map((c) => c.delay)
    );
    settleTimer.current = window.setTimeout(() => {
      setDescCols((cols) => cols.map((c) => ({ ...c, rest: c.final, play: c.final, delay: 0 })));
      setAscCols((cols) => cols.map((c) => ({ ...c, rest: c.final, play: c.final, delay: 0 })));
      setArmed(false);
    }, maxDelay + ROLL_MS + 30);

    return () => {
      if (armRaf.current !== undefined) cancelAnimationFrame(armRaf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balanceCents]);

  useEffect(
    () => () => {
      window.clearTimeout(settleTimer.current);
      if (armRaf.current !== undefined) cancelAnimationFrame(armRaf.current);
    },
    []
  );

  const [frank, setFrank] = useState<Frank | null>(null);
  const [batch, setBatch] = useState(0);
  const [diePhase, setDiePhase] = useState<"rest" | "down" | "up">("rest");
  const [announced, setAnnounced] = useState("");
  const serialRef = useRef(0);
  const dieTimers = useRef<number[]>([]);

  const commit = () => {
    if (!canCommit) return;
    const nextBalanceCents = balanceCents - amountCents;
    serialRef.current += 1;
    const now = new Date();
    const nextFrank: Frank = {
      amountCents,
      date: formatFrankDate(now),
      serial: String(serialRef.current).padStart(6, "0"),
    };

    // one commit, one governing scalar (amountCents) feeding the balance
    // update, the frank, and the die trigger together — never three
    // independently-timed writes.
    setFrank(nextFrank);
    setBatch((b) => b + 1);
    if (!isControlled) setInternalCents(nextBalanceCents);
    onCommit?.(amountCents / 100, nextBalanceCents / 100);
    setAnnounced(
      `Stamped — ${fmt(amountCents)}. Balance ${fmt(nextBalanceCents)} remaining, ` +
        `${fmt(creditsCents - nextBalanceCents)} spent to date, registers reconcile.`
    );

    dieTimers.current.forEach((t) => window.clearTimeout(t));
    dieTimers.current = [];
    if (!reducedMotion) {
      setDiePhase("down");
      dieTimers.current.push(
        window.setTimeout(() => setDiePhase("up"), DIE_DROP_MS + DIE_DWELL_MS)
      );
      dieTimers.current.push(
        window.setTimeout(() => setDiePhase("rest"), DIE_DROP_MS + DIE_DWELL_MS + DIE_RETURN_MS)
      );
    }
  };

  useEffect(() => () => dieTimers.current.forEach((t) => window.clearTimeout(t)), []);

  const dieTransform = diePhase === "down" ? "translateY(8px)" : "translateY(0px)";
  const dieTransition =
    reducedMotion || diePhase === "rest"
      ? "none"
      : diePhase === "down"
        ? `transform ${DIE_DROP_MS}ms ${DIE_DROP_EASE}`
        : `transform ${DIE_RETURN_MS}ms ease-in`;

  const frankAlt = frank
    ? `Franking indicium: ${fmt(frank.amountCents)}, stamped ${frank.date}, serial ${frank.serial}`
    : "";

  return (
    <div className={`ns-fr-root ${className}`} data-reduced={reducedMotion || undefined}>
      <div className="ns-fr-card">
        <div className="ns-fr-head">
          <span className="ns-fr-kicker">Invoice</span>
          {description && <span className="ns-fr-desc">{description}</span>}
        </div>

        <div className="ns-fr-amount-row">
          <span className="ns-fr-amount">{fmt(amountCents)}</span>
          <span className="ns-fr-amount-label">due</span>
        </div>

        <div className="ns-fr-stampzone">
          {frank && (
            <svg
              key={batch}
              role="img"
              aria-label={frankAlt}
              viewBox="0 0 168 76"
              className="ns-fr-frank"
              style={{ animationDelay: reducedMotion ? "0ms" : `${DIE_DROP_MS}ms` }}
            >
              <rect x="1" y="1" width="166" height="74" rx="6" className="ns-fr-frank-border" />
              <g transform="translate(38, 38)" className="ns-fr-frank-rosette">
                {Array.from({ length: 12 }, (_, i) => {
                  const a = (i * 30 * Math.PI) / 180;
                  const x1 = Math.cos(a) * 9;
                  const y1 = Math.sin(a) * 9;
                  const x2 = Math.cos(a) * 15;
                  const y2 = Math.sin(a) * 15;
                  return (
                    <line
                      key={i}
                      x1={x1.toFixed(2)}
                      y1={y1.toFixed(2)}
                      x2={x2.toFixed(2)}
                      y2={y2.toFixed(2)}
                      className="ns-fr-frank-ray"
                    />
                  );
                })}
                <circle r="16" className="ns-fr-frank-ring" />
                <circle r="2.5" className="ns-fr-frank-hub" />
              </g>
              <line x1="70" y1="8" x2="70" y2="68" className="ns-fr-frank-div" />
              <text x="80" y="34" className="ns-fr-frank-amt">
                {fmt(frank.amountCents)}
              </text>
              <text x="80" y="49" className="ns-fr-frank-date">
                {frank.date}
              </text>
              <text x="80" y="63" className="ns-fr-frank-serial">
                SER {frank.serial}
              </text>
            </svg>
          )}
        </div>

        <button
          type="button"
          className="ns-fr-die"
          aria-label={`${actionLabel} ${fmt(amountCents)}`}
          disabled={!canCommit}
          onClick={commit}
          style={{ transform: reducedMotion ? undefined : dieTransform, transition: dieTransition }}
        >
          <span aria-hidden="true" className="ns-fr-die-label">
            {actionLabel}
          </span>
          <span aria-hidden="true" className="ns-fr-die-amt">
            {fmt(amountCents)}
          </span>
        </button>
      </div>

      <div className="ns-fr-registers">
        <div className="ns-fr-register">
          <span className="ns-fr-reg-caption">Balance</span>
          <WheelRow cols={descCols} armed={armed} />
          <span className="ns-fr-reg-mirror">{fmt(balanceCents)}</span>
        </div>
        <div className="ns-fr-register">
          <span className="ns-fr-reg-caption">Spent to date</span>
          <WheelRow cols={ascCols} armed={armed} />
          <span className="ns-fr-reg-mirror">{fmt(spentCents)}</span>
        </div>
      </div>

      <p className="ns-fr-reconcile">registers reconcile: {fmt(creditsCents)}</p>

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announced}
      </div>

      <style>{`
        .ns-fr-root {
          display: flex;
          flex-direction: column;
          gap: 14px;
          width: 100%;
          max-width: 22rem;
          font-family: var(--font-sans);
          color: var(--foreground);
        }
        .ns-fr-card {
          position: relative;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--background);
          padding: 16px 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ns-fr-head {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .ns-fr-kicker {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--ns-muted);
        }
        .ns-fr-desc {
          font-size: 13px;
          color: var(--foreground);
        }
        .ns-fr-amount-row {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }
        .ns-fr-amount {
          font-family: var(--font-mono);
          font-size: 26px;
          font-weight: 500;
          font-variant-numeric: tabular-nums;
        }
        .ns-fr-amount-label {
          font-size: 12px;
          color: var(--ns-muted);
        }
        .ns-fr-stampzone {
          min-height: 78px;
          display: flex;
          align-items: center;
        }
        .ns-fr-frank {
          width: 100%;
          max-width: 220px;
          height: auto;
          overflow: visible;
          animation: ns-fr-press ${PRESS_MS}ms ease-out both;
        }
        .ns-fr-frank-border {
          fill: none;
          stroke: var(--border);
          stroke-width: 1.5px;
          stroke-dasharray: 3 2.5;
        }
        .ns-fr-frank-ray {
          stroke: var(--ns-muted);
          stroke-width: 1.2px;
        }
        .ns-fr-frank-ring {
          fill: none;
          stroke: var(--foreground);
          stroke-width: 1.4px;
        }
        .ns-fr-frank-hub {
          fill: var(--foreground);
        }
        .ns-fr-frank-div {
          stroke: var(--border);
          stroke-width: 1px;
        }
        .ns-fr-frank-amt {
          font-family: var(--font-mono);
          font-size: 15px;
          font-weight: 600;
          fill: var(--foreground);
        }
        .ns-fr-frank-date {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.06em;
          fill: var(--foreground);
        }
        .ns-fr-frank-serial {
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: 0.05em;
          fill: var(--ns-muted);
        }
        @keyframes ns-fr-press {
          0% { opacity: 0.35; }
          55% { opacity: 1; filter: brightness(1.25); }
          100% { opacity: 1; filter: brightness(1); }
        }

        .ns-fr-die {
          align-self: flex-start;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          padding: 8px 14px;
          border: 1px solid var(--foreground);
          border-radius: 6px;
          background: var(--background);
          color: var(--foreground);
          cursor: pointer;
          outline: none;
          -webkit-tap-highlight-color: transparent;
        }
        .ns-fr-die:not(:disabled):hover {
          background: color-mix(in oklab, var(--foreground) 6%, transparent);
        }
        .ns-fr-die:focus-visible {
          outline: 2px solid var(--ns-accent);
          outline-offset: 2px;
        }
        .ns-fr-die:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .ns-fr-die-label {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ns-muted);
        }
        .ns-fr-die-amt {
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 600;
        }

        .ns-fr-registers {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .ns-fr-register {
          display: flex;
          flex-direction: column;
          gap: 4px;
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 8px 10px;
        }
        .ns-fr-reg-caption {
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ns-muted);
        }
        .ns-fr-wheel {
          display: flex;
          font-family: var(--font-mono);
          font-size: 15px;
          font-weight: 600;
          line-height: ${ROW_EM};
        }
        .ns-fr-wcell {
          display: inline-block;
          width: 1ch;
          height: ${ROW_EM}em;
          overflow: hidden;
        }
        .ns-fr-wtrack {
          display: flex;
          flex-direction: column;
          will-change: transform;
        }
        .ns-fr-wdigit {
          height: ${ROW_EM}em;
          line-height: ${ROW_EM}em;
          text-align: center;
        }
        .ns-fr-reg-mirror {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--ns-muted);
        }

        .ns-fr-reconcile {
          margin: 0;
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.04em;
          color: var(--ns-muted);
          text-align: center;
        }

        .ns-fr-root[data-reduced] .ns-fr-frank {
          animation: none;
          opacity: 1;
        }
        @media (prefers-reduced-motion: reduce) {
          .ns-fr-frank {
            animation: none;
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
