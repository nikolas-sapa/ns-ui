"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ContraStrike — an order's line-item ledger, rendered as a real <table>,
// where a partial refund is recorded the way bookkeepers actually record one:
// nothing about the original entry is ever touched. Dragging along a line's
// amount bar arms a struck fraction `s` (a single governing scalar) that
// simultaneously sizes the refund figure, the length of an SVG rule crossing
// the amount, and — once a real "Refund $x" button commits it — the width of
// a brand-new contra row's own bar on the SAME money-per-px scale. The
// struck row's DOM node is never edited or removed: its figures stay exactly
// as billed, decorated (not deleted) with a permanent line-through, and the
// correction lives one row down, forever, in Geist Mono with a leading
// minus. Quantity lines snap the drag to whole units (2 of 6, never 2.4 of
// 6); a flat line with no quantity snaps to the cent instead. The rule stays
// dashed for as long as the row is only armed, not booked — a mid-drag
// selection must never read as an already-settled correction — and turns
// solid at the same instant the contra row is appended and the balance
// re-derives.
// ---------------------------------------------------------------------------

export interface ContraStrikeLine {
  id: string;
  /** line description, e.g. "Wireless Mouse ×6" */
  description: string;
  /** unit count on this line — 1 for a flat/non-quantity line */
  qty: number;
  /** price per unit, dollars */
  unitPrice: number;
  /** seed this line as already armed (dragged, not yet committed), 0-1 */
  defaultStruck?: number;
  /** seed this line as already refunded at mount — contra row renders open,
   * no animation, matching how a history feed replays a past decision */
  committedStruck?: number;
}

export interface ContraStrikeProps {
  /** heading shown above the ledger, e.g. "Order #4471" */
  orderLabel?: string;
  /** the order's line items */
  lines: ContraStrikeLine[];
  /** ISO currency code passed to Intl.NumberFormat */
  currency?: string;
  /** BCP 47 locale passed to Intl.NumberFormat — always explicit, never the
   * runtime default, so server and client render identical digits */
  locale?: string;
  /** fired once per line the moment its contra row is committed */
  onCommit?: (line: ContraStrikeLine, refundAmount: number, struckUnits: number) => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

type LineState = {
  input: ContraStrikeLine;
  amount: number;
  struck: number; // 0-1, the armed/committed fraction — the one governing scalar
  dragging: boolean;
  committed: boolean;
  contraOpen: boolean; // flips true one frame after `committed` so the height
  // transition has a 0-height frame to animate FROM, per prevailing bug
};

const TRACK_W = 148; // px — the shared money-per-px track width every bar maps onto
const ROW_H = 30; // px — fixed row height, both the original and contra rows

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function snapFraction(raw: number, qty: number, amount: number): number {
  const r = clamp(raw, 0, 1);
  if (qty > 1) {
    const k = Math.round(r * qty);
    return clamp(k / qty, 0, 1);
  }
  const cents = Math.round(amount * 100);
  if (cents <= 0) return 0;
  const c = Math.round(r * cents);
  return clamp(c / cents, 0, 1);
}

function stepFraction(qty: number, amount: number): number {
  if (qty > 1) return 1 / qty;
  const cents = Math.round(amount * 100);
  return cents > 0 ? 1 / cents : 0;
}

export function ContraStrike({
  orderLabel = "Order",
  lines,
  currency = "USD",
  locale = "en-US",
  onCommit,
  className = "",
}: ContraStrikeProps) {
  const money = useMemo(() => {
    const fmt = new Intl.NumberFormat(locale, { style: "currency", currency });
    return (v: number) => fmt.format(v);
  }, [locale, currency]);

  const [rows, setRows] = useState<LineState[]>(() =>
    lines.map((input) => {
      const amount = input.qty * input.unitPrice;
      const committed = input.committedStruck !== undefined;
      const struck = committed
        ? clamp(input.committedStruck as number, 0, 1)
        : clamp(input.defaultStruck ?? 0, 0, 1);
      return { input, amount, struck, dragging: false, committed, contraOpen: committed };
    })
  );

  const maxAmount = useMemo(
    () => Math.max(1, ...rows.map((r) => r.amount)),
    [rows]
  );
  const scale = TRACK_W / maxAmount;
  const barPx = (amount: number) => Math.max(2, amount * scale);

  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const [announcement, setAnnouncement] = useState("");
  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  const [balanceFlash, setBalanceFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  function updateStruck(idx: number, raw: number, dragging: boolean) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx || r.committed) return r;
        const q = snapFraction(raw, r.input.qty, r.amount);
        return { ...r, struck: q, dragging };
      })
    );
  }

  function trackDrag(idx: number, clientX: number, dragging: boolean) {
    const el = trackRefs.current[idx];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const raw = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    updateStruck(idx, raw, dragging);
  }

  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Reads the outer `rows` state, not the updater's `prev`: every side effect
  // (onCommit, the announcement, the flash timer, the rAF pair) runs exactly
  // once per click, in the function body — never inside setRows' updater,
  // which React is free to invoke more than once. An append-only ledger that
  // fired its own commit callback twice would be the exact bug this
  // component exists to prevent.
  function commitLine(idx: number) {
    const row = rows[idx];
    if (!row || row.committed || row.struck <= 0) return;
    const refundAmount = row.amount * row.struck;
    const struckUnits = row.input.qty > 1 ? Math.round(row.struck * row.input.qty) : 0;
    const newRefunded = rows.reduce(
      (s, r, i) => s + (i === idx ? refundAmount : r.committed ? r.amount * r.struck : 0),
      0
    );

    setRows((prev) => {
      const cur = prev[idx];
      if (!cur || cur.committed) return prev; // idempotence guard, belt-and-braces
      return prev.map((r, i) =>
        i === idx ? { ...r, committed: true, contraOpen: reducedMotion } : r
      );
    });

    onCommit?.(row.input, refundAmount, struckUnits);
    setAnnouncement(
      `Refund recorded: −${money(refundAmount)} for ${row.input.description}. New balance ${money(subtotal - newRefunded)}.`
    );
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlashIdx(idx);
    setBalanceFlash(true);
    flashTimer.current = setTimeout(() => {
      setFlashIdx(null);
      setBalanceFlash(false);
    }, 500);
    if (!reducedMotion) {
      // two rAFs: the first lets the browser paint the just-mounted,
      // zero-height contra row; only the second flips it open, so the
      // height transition has a real starting frame to animate from
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setRows((cur) => cur.map((r, i) => (i === idx ? { ...r, contraOpen: true } : r)));
        });
      });
    }
  }

  function onTrackKeyDown(e: React.KeyboardEvent, idx: number) {
    const row = rows[idx];
    if (!row || row.committed) return;
    const step = stepFraction(row.input.qty, row.amount);
    let next: number | null = null;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = row.struck + step;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = row.struck - step;
        break;
      case "PageUp":
        next = row.struck + step * (row.input.qty > 1 ? 1 : 10);
        break;
      case "PageDown":
        next = row.struck - step * (row.input.qty > 1 ? 1 : 10);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    updateStruck(idx, clamp(next, 0, 1), false);
  }

  const subtotal = rows.reduce((s, r) => s + r.amount, 0);
  const refunded = rows.reduce((s, r) => (r.committed ? s + r.amount * r.struck : s), 0);
  const balance = subtotal - refunded;

  return (
    <div className={`w-full ${className}`}>
      <style>{`
@keyframes ns-cs-contra-row{from{opacity:0}to{opacity:1}}
.ns-cs-contra{transition:height 320ms cubic-bezier(0.16,1,0.3,1), opacity 320ms cubic-bezier(0.16,1,0.3,1);overflow:hidden}
.ns-cs-rule{transition:opacity 180ms ease-out}
@keyframes ns-cs-flash{0%{opacity:.35}100%{opacity:0}}
.ns-cs-flash::after{content:"";position:absolute;inset:-2px -6px;background:var(--ns-accent);opacity:0;border-radius:6px;animation:ns-cs-flash 480ms ease-out;pointer-events:none}
@media (prefers-reduced-motion: reduce){
  .ns-cs-contra{transition:none}
  .ns-cs-rule{transition:none}
  .ns-cs-flash::after{animation:none}
}
`}</style>

      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-mono text-sm font-medium text-foreground">{orderLabel}</h3>
        <span className="font-mono text-xs text-ns-muted">line-item ledger</span>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            {orderLabel} line-item ledger with per-line partial refund. Refunds append a
            contra entry below the original line rather than editing it.
          </caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="px-3 py-2 font-mono text-xs font-normal text-ns-muted">
                Item
              </th>
              <th scope="col" className="px-3 py-2 text-right font-mono text-xs font-normal text-ns-muted">
                Qty
              </th>
              <th scope="col" className="px-3 py-2 font-mono text-xs font-normal text-ns-muted">
                Amount
              </th>
              <th scope="col" className="px-3 py-2 font-mono text-xs font-normal text-ns-muted">
                <span className="sr-only">Refund action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const { input, amount, struck, committed, dragging, contraOpen } = row;
              const refundAmount = amount * struck;
              const bar = barPx(amount);
              const ruleLen = struck * bar;
              const struckUnits = input.qty > 1 ? Math.round(struck * input.qty) : 0;
              const valueText =
                input.qty > 1
                  ? `${money(refundAmount)} of ${money(amount)}, ${struckUnits} of ${input.qty} units`
                  : `${money(refundAmount)} of ${money(amount)}`;
              const armed = struck > 0;
              const flashing = flashIdx === idx;

              return (
                <Fragment key={input.id}>
                  <tr
                    className={
                      "border-b border-border last:border-b-0" +
                      (committed ? " align-top" : "")
                    }
                    {...(committed
                      ? { "aria-description": "partially refunded, see contra entry below" }
                      : {})}
                  >
                    <th scope="row" className="px-3 py-2 align-top font-mono text-xs font-normal text-foreground">
                      {input.description}
                    </th>
                    <td className="px-3 py-2 text-right align-top font-mono text-xs tabular-nums text-ns-muted">
                      {input.qty}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {/* the interactive slider below is entirely aria-hidden
                      inside (aria-valuetext is its single source of truth for
                      AT); this sibling restores the cell's plain reading-mode
                      data — the billed amount, struck once refunded — so the
                      row stays real, walkable table content and not just a
                      widget's private value */}
                      <span className="sr-only">
                        {money(amount)}
                        {committed ? ", struck, see contra entry below" : ""}
                      </span>
                      <div
                        ref={(el) => {
                          trackRefs.current[idx] = el;
                        }}
                        data-track={idx}
                        role="slider"
                        tabIndex={committed ? -1 : 0}
                        aria-disabled={committed || undefined}
                        aria-label={`Refund ${input.description}`}
                        aria-orientation="horizontal"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(struck * 100)}
                        aria-valuetext={valueText}
                        onKeyDown={(e) => onTrackKeyDown(e, idx)}
                        onPointerDown={(e) => {
                          if (committed) return;
                          e.preventDefault();
                          e.currentTarget.setPointerCapture(e.pointerId);
                          trackDrag(idx, e.clientX, true);
                        }}
                        onPointerMove={(e) => {
                          if (!dragging) return;
                          trackDrag(idx, e.clientX, true);
                        }}
                        onPointerUp={() => updateStruck(idx, struck, false)}
                        onPointerCancel={() => updateStruck(idx, struck, false)}
                        style={{ width: TRACK_W, height: ROW_H }}
                        className={
                          "relative select-none rounded-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background" +
                          (committed
                            ? " cursor-default"
                            : " cursor-ew-resize touch-none hover:bg-foreground/[0.035]") +
                          (flashing ? " ns-cs-flash" : "")
                        }
                      >
                        {/* the slider's own visual layers (bar, numeral, rule)
                        carry no text to assistive tech — aria-valuetext above
                        is the single source of truth for the control's value
                        — so the billed amount is restated here as real,
                        readable table-cell data, exactly once */}
                        <span className="sr-only">
                          {money(amount)}
                          {committed ? ", struck, see contra entry below" : ""}
                        </span>
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-foreground/[0.07]"
                          style={{ width: bar, height: 3 }}
                        />
                        <span
                          aria-hidden
                          className={
                            "absolute left-0 top-1/2 flex h-full -translate-y-1/2 items-center font-mono text-sm tabular-nums" +
                            (committed
                              ? " text-foreground line-through decoration-1 decoration-foreground/70"
                              : " text-foreground")
                          }
                        >
                          {money(amount)}
                        </span>
                        {armed ? (
                          <svg
                            aria-hidden
                            className="ns-cs-rule pointer-events-none absolute inset-0"
                            width={TRACK_W}
                            height={ROW_H}
                          >
                            <line
                              x1={0}
                              y1={ROW_H / 2}
                              x2={Math.max(1, ruleLen)}
                              y2={ROW_H / 2}
                              stroke="var(--foreground)"
                              strokeWidth={1.5}
                              strokeLinecap="round"
                              strokeDasharray={committed ? undefined : "4 3"}
                            />
                          </svg>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-right">
                      <button
                        type="button"
                        data-commit={idx}
                        onClick={() => commitLine(idx)}
                        className="rounded-sm border border-border px-2.5 py-1 font-mono text-xs text-foreground transition-colors hover:bg-foreground/[0.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent disabled:pointer-events-none disabled:opacity-40"
                        disabled={committed || !armed}
                      >
                        {committed
                          ? "Refunded"
                          : armed
                            ? `Refund ${money(refundAmount)}`
                            : "Refund"}
                      </button>
                    </td>
                  </tr>

                  {committed ? (
                    <tr key={`${input.id}-contra`} data-contra={idx} className="border-b border-border last:border-b-0">
                      <td colSpan={4} className="p-0">
                        <div
                          className="ns-cs-contra"
                          style={{ height: contraOpen ? ROW_H : 0, opacity: contraOpen ? 1 : 0 }}
                        >
                          <div
                            className="flex items-center gap-3 px-3 font-mono text-xs"
                            style={{ height: ROW_H, animation: contraOpen ? "ns-cs-contra-row 200ms ease-out" : "none" }}
                          >
                            <span className="w-0 flex-1 truncate text-ns-muted">
                              Contra — {input.description}
                            </span>
                            <span className="shrink-0 text-right text-ns-muted">
                              {input.qty > 1 ? `−${struckUnits} of ${input.qty} units` : ""}
                            </span>
                            <span
                              aria-hidden
                              className="relative shrink-0 rounded-full bg-foreground/[0.14]"
                              style={{ width: ruleLen, height: 3 }}
                            />
                            <span className="shrink-0 tabular-nums text-foreground">
                              −{money(refundAmount)}
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <th scope="row" colSpan={3} className="px-3 py-2 text-right font-mono text-xs font-normal text-ns-muted">
                Subtotal
              </th>
              <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-ns-muted">
                {money(subtotal)}
              </td>
            </tr>
            <tr>
              <th scope="row" colSpan={3} className="px-3 py-2 text-right font-mono text-xs font-normal text-ns-muted">
                Refunded
              </th>
              <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-ns-muted">
                −{money(refunded)}
              </td>
            </tr>
            <tr className="border-t border-border">
              <th scope="row" colSpan={3} className="px-3 py-2 text-right font-mono text-sm font-medium text-foreground">
                Balance
              </th>
              <td className="px-3 py-2 text-right align-middle">
                <span
                  className={"relative inline-block font-mono text-sm font-medium tabular-nums text-foreground" + (balanceFlash ? " ns-cs-flash" : "")}
                >
                  {money(balance)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
