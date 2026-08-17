"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// CrossfootGap — an invoice/allocation grid that validates itself the way a
// bookkeeper crossfoots a paper ledger: foot every row, foot every column,
// and check the two grand totals meet in the corner. Each ROW carries a
// stated amount (the ground truth — a receipt total, an invoice line, a
// budget cap) that is NOT itself computed from the grid; each interior cell
// is where the user TYPES how that amount splits across columns (cost
// codes, periods, categories). Because the stated amounts and the typed
// splits are two independently-sourced numbers, they can genuinely
// disagree — unlike a plain matrix where row-sums and column-sums of the
// SAME cells are always identical by construction, this is a real
// reconciliation: forget to code part of a receipt and the grid falls
// short by exactly that amount; mistype a digit and it's off by pennies.
//
// MECHANISM: one function (computeLedger, below) derives { rowStated,
// colTotals, sumStated, sumAllocated, diffCents } from props in a single
// pass — the same object feeds both the printed row/column/grand totals AND
// the gap's pixel width, so there is no second calculation that could drift
// out of sync with what's on screen. gapPx = 0 when diffCents === 0,
// otherwise clamp(3, log1p(|$|)/log1p(10000) * 24, 24) — a floor so a
// one-cent miss is never rendered as "closed", a log curve so a $0.09 typo
// and a $1,240 dropped line read as visibly different widths, and a 24px
// ceiling so the gap can never push the table into reflow.
//
// GEOMETRY: a single <svg> overlays the table (position:relative wrapper).
// The horizontal closing rule runs from the table's left edge to
// cornerX − gap/2 at y = cornerY (the top of the footer row); the vertical
// closing rule runs from the table's top edge to cornerY − gap/2 at
// x = cornerX (the left edge of the row-totals column). cornerX/cornerY are
// measured directly off the grand-total <td> via getBoundingClientRect, so
// the rules always terminate exactly at its corner regardless of column
// widths. The signed diff prints in Geist Mono, decorative and aria-hidden,
// centered on the corner and rotated 45° — along the bisector of the
// opening between a rule receding left and one receding up. Gap width eases
// toward its target via a small rAF tween (ease-out-cubic, ~240ms) rather
// than a CSS transition on raw SVG geometry, so it holds up everywhere.
// At diffCents === 0 a second pair of hairlines — the accountant's double
// rule — inks in under the grand-total figure via a pathLength=1
// stroke-dashoffset keyframe (350ms, ease-out-expo), keyed so it replays
// every time the ledger newly closes, not just once.
//
// A11Y: a real <table>; every interior <input> carries its own aria-label
// ("<row> allocated to <column>"); row/column/grand totals are read-only
// <td>s with tabIndex=0 so they're reachable but never mistaken for
// editable fields; the grand-total cell's own visible text states the
// reconciled status in words ("Ledger closed" / "off by −$0.09") — the
// SVG's rotated echo is decoration, not the only channel. A debounced
// aria-live=polite region mirrors the same status ("out of balance by
// −$12.40" / "Ledger closed") without announcing every keystroke. No
// submit step: every number is live off controlled state. Reduced motion
// removes the tween (gap width jumps straight to target) and the ink-in
// keyframe (double rule is simply present, fully drawn).
// ---------------------------------------------------------------------------

export interface CrossfootColumn {
  id: string;
  /** column header, e.g. a cost code or period */
  label: string;
}

export interface CrossfootRow {
  id: string;
  /** row header, e.g. a receipt or line-item description */
  label: string;
  /** the stated / ground-truth amount for this line, in dollars */
  amount: number;
}

export interface CrossfootGapProps {
  columns: CrossfootColumn[];
  rows: CrossfootRow[];
  /** controlled split: cells[rowId]?.[colId] = the raw string currently typed into that cell */
  cells: Record<string, Record<string, string>>;
  onCellChange: (rowId: string, colId: string, value: string) => void;
  /** currency symbol prefix for every printed amount. default "$" */
  currency?: string;
  /** accessible name for the table. default "Invoice ledger" */
  ariaLabel?: string;
  /** row-header column heading. default "Line item" */
  rowHeaderLabel?: string;
  /** footer row heading, above the computed column totals. default "Allocated" */
  footerLabel?: string;
  className?: string;
}

const TWEEN_MS = 240;
const WIPE_MS = 350;
const LIVE_DEBOUNCE_MS = 500;
const MIN_GAP_PX = 3;
const MAX_GAP_PX = 24;
const GAP_SATURATION_DOLLARS = 10000;

function toCents(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  if (!cleaned) return 0;
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function formatCents(cents: number, currency: string): string {
  const dollars = Math.floor(cents / 100);
  const rem = cents % 100;
  return `${currency}${dollars.toLocaleString("en-US")}.${String(rem).padStart(2, "0")}`;
}

function formatSigned(diffCents: number, currency: string): string {
  const sign = diffCents < 0 ? "−" : "+";
  return `${sign}${formatCents(Math.abs(diffCents), currency)}`;
}

function gapPxFromDiff(diffCents: number): number {
  if (diffCents === 0) return 0;
  const dollars = Math.abs(diffCents) / 100;
  const t = Math.log1p(dollars) / Math.log1p(GAP_SATURATION_DOLLARS);
  const px = MIN_GAP_PX + t * (MAX_GAP_PX - MIN_GAP_PX);
  return Math.min(MAX_GAP_PX, Math.max(MIN_GAP_PX, px));
}

function computeLedger(rows: CrossfootRow[], columns: CrossfootColumn[], cells: CrossfootGapProps["cells"]) {
  const colTotals = columns.map((col) =>
    rows.reduce((sum, row) => sum + toCents(cells[row.id]?.[col.id]), 0)
  );
  const rowStated = rows.map((row) => Math.round(row.amount * 100));
  const sumStated = rowStated.reduce((a, b) => a + b, 0);
  const sumAllocated = colTotals.reduce((a, b) => a + b, 0);
  const diffCents = sumAllocated - sumStated;
  return { colTotals, rowStated, sumStated, sumAllocated, diffCents, gapPx: gapPxFromDiff(diffCents) };
}

export function CrossfootGap({
  columns,
  rows,
  cells,
  onCellChange,
  currency = "$",
  ariaLabel = "Invoice ledger",
  rowHeaderLabel = "Line item",
  footerLabel = "Allocated",
  className = "",
}: CrossfootGapProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cornerRef = useRef<HTMLTableCellElement>(null);
  const headlineRef = useRef<HTMLSpanElement>(null);

  const [reducedMotion, setReducedMotion] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [corner, setCorner] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [headline, setHeadline] = useState({ y: 0 });
  const [gapAnim, setGapAnim] = useState(0);
  const [closedKey, setClosedKey] = useState(0);
  const [liveMsg, setLiveMsg] = useState("");

  const gapAnimRef = useRef(0);
  const prevDiffRef = useRef<number | null>(null);
  const liveTimerRef = useRef<number | undefined>(undefined);

  const ledger = useMemo(() => computeLedger(rows, columns, cells), [rows, columns, cells]);
  const { colTotals, rowStated, sumStated, diffCents, gapPx } = ledger;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Measure the grand-total corner (and the wrap it's positioned against)
  // straight off the DOM so the closing rules terminate exactly at its
  // edges no matter how column widths land.
  useLayoutEffect(() => {
    function measure() {
      const wrap = wrapRef.current;
      const cornerEl = cornerRef.current;
      if (!wrap || !cornerEl) return;
      const wrapRect = wrap.getBoundingClientRect();
      const cRect = cornerEl.getBoundingClientRect();
      setSize({ w: wrap.scrollWidth, h: wrap.scrollHeight });
      setCorner({
        x: cRect.left - wrapRect.left + wrap.scrollLeft,
        y: cRect.top - wrapRect.top + wrap.scrollTop,
        w: cRect.width,
        h: cRect.height,
      });
      const hEl = headlineRef.current;
      if (hEl) {
        const hRect = hEl.getBoundingClientRect();
        setHeadline({ y: hRect.bottom - wrapRect.top + wrap.scrollTop });
      }
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [rows, columns, cells]);

  // Ease the gap width toward its target instead of snapping — a small
  // hand-rolled tween rather than a CSS transition on raw SVG attributes,
  // which does not animate reliably everywhere.
  useEffect(() => {
    if (reducedMotion) {
      setGapAnim(gapPx);
      gapAnimRef.current = gapPx;
      return;
    }
    let raf = 0;
    const from = gapAnimRef.current;
    const to = gapPx;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / TWEEN_MS);
      const eased = 1 - (1 - t) ** 3;
      const val = from + (to - from) * eased;
      gapAnimRef.current = val;
      setGapAnim(val);
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gapPx, reducedMotion]);

  // Replay the double-rule ink-in every time the ledger newly closes, not
  // just on the first render it happens to already be closed.
  useEffect(() => {
    if (prevDiffRef.current !== null && prevDiffRef.current !== 0 && diffCents === 0) {
      setClosedKey((k) => k + 1);
    }
    prevDiffRef.current = diffCents;
  }, [diffCents]);

  // Debounce the live-region announcement so typing doesn't narrate every
  // keystroke — the visual gap already updates immediately.
  useEffect(() => {
    if (liveTimerRef.current) window.clearTimeout(liveTimerRef.current);
    liveTimerRef.current = window.setTimeout(() => {
      setLiveMsg(diffCents === 0 ? "Ledger closed" : `out of balance by ${formatSigned(diffCents, currency)}`);
    }, LIVE_DEBOUNCE_MS);
    return () => {
      if (liveTimerRef.current) window.clearTimeout(liveTimerRef.current);
    };
  }, [diffCents, currency]);

  const closed = diffCents === 0;
  const cornerLabel = closed
    ? `Grand total ${formatCents(sumStated, currency)} — Ledger closed`
    : `Grand total ${formatCents(sumStated, currency)} — out of balance by ${formatSigned(diffCents, currency)}`;

  const notchX = corner.x + gapAnim * 0.5;
  const notchY = corner.y + gapAnim * 0.5;

  return (
    <div className={["ns-cf", className].join(" ")}>
      <style>{`
.ns-cf-scroll{overflow-x:auto}
.ns-cf-wrap{position:relative}
.ns-cf table{border-collapse:collapse;width:100%}
.ns-cf th,.ns-cf td{white-space:nowrap}
.ns-cf thead th{font:12px/1.3 var(--font-mono, ui-monospace, monospace);text-transform:uppercase;letter-spacing:.08em;color:var(--ns-muted);text-align:right;padding:0 10px 8px;font-weight:500}
.ns-cf thead th:first-child,.ns-cf tbody th{text-align:left}
.ns-cf tbody th{font:13px/1.4 var(--font-mono, ui-monospace, monospace);color:var(--foreground);font-weight:400;padding:7px 10px 7px 2px;border-top:1px solid var(--border)}
.ns-cf tbody td{padding:5px 10px;border-top:1px solid var(--border);text-align:right}
.ns-cf tbody tr:first-child th,.ns-cf tbody tr:first-child td{border-top:none}
.ns-cf-input{width:6.4em;text-align:right;background:transparent;color:var(--foreground);font:13px/1.4 var(--font-mono, ui-monospace, monospace);border:1px solid transparent;border-radius:6px;padding:4px 6px;outline:none}
.ns-cf-input::placeholder{color:var(--ns-muted);opacity:.55}
.ns-cf-input:hover{border-color:var(--border)}
.ns-cf-input:focus-visible{border-color:transparent;outline:2px solid var(--ns-accent);outline-offset:1px}
.ns-cf-rowtotal{font:13px/1.4 var(--font-mono, ui-monospace, monospace);color:var(--ns-muted);padding:5px 2px 5px 10px}
.ns-cf-rowtotal:focus-visible{outline:2px solid var(--ns-accent);outline-offset:-1px;border-radius:4px}
.ns-cf-foot th{text-align:left;font:12px/1.3 var(--font-mono, ui-monospace, monospace);color:var(--ns-muted);padding:10px 10px 10px 2px;font-weight:400}
.ns-cf-foot td{font:13px/1.4 var(--font-mono, ui-monospace, monospace);color:var(--foreground);padding:10px;text-align:right}
.ns-cf-foot td:focus-visible,.ns-cf-foot th:focus-visible{outline:2px solid var(--ns-accent);outline-offset:-1px;border-radius:4px}
.ns-cf-corner{vertical-align:top;position:relative}
/* gap must clear the double rule, which the SVG overlay draws at
   headline.bottom + 4px and + 7px. At the original 2px the status caption
   started at +2 and the two rules struck straight through "Ledger closed".
   12px puts the caption 5px below the lower rule, so the corner reads as an
   accountant's block: figure, double underline, then the status word. */
.ns-cf-corner-inner{display:inline-flex;flex-direction:column;align-items:flex-end;gap:12px}
.ns-cf-corner-headline{font-size:14px;color:var(--foreground)}
.ns-cf-corner-status{font-size:11px;color:var(--ns-muted)}
.ns-cf-corner[data-closed="true"] .ns-cf-corner-status{color:var(--foreground)}
.ns-cf-rules{position:absolute;inset:0;pointer-events:none}
.ns-cf-rule{stroke:var(--border);stroke-width:1;transition:none}
.ns-cf-double-line{stroke:var(--foreground);stroke-width:1;fill:none;stroke-dasharray:1;stroke-dashoffset:0}
.ns-cf-double[data-anim="true"] .ns-cf-double-line{animation:ns-cf-wipe ${WIPE_MS}ms cubic-bezier(.16,1,.3,1) forwards}
@keyframes ns-cf-wipe{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
.ns-cf-notch{position:absolute;font:11px/1 var(--font-mono, ui-monospace, monospace);color:var(--foreground);transform:translate(-50%,-50%) rotate(45deg);white-space:nowrap;pointer-events:none}
@media (prefers-reduced-motion: reduce){
  .ns-cf-double-line{animation:none!important;stroke-dashoffset:0!important}
}
`}</style>

      <div className="ns-cf-scroll rounded-xl border border-border bg-background">
        <div ref={wrapRef} className="ns-cf-wrap px-3 py-3">
          <table aria-label={ariaLabel}>
            <thead>
              <tr>
                <th scope="col">{rowHeaderLabel}</th>
                {columns.map((col) => (
                  <th scope="col" key={col.id}>
                    {col.label}
                  </th>
                ))}
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={row.id}>
                  <th scope="row">{row.label}</th>
                  {columns.map((col) => (
                    <td key={col.id}>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="ns-cf-input"
                        placeholder="0.00"
                        aria-label={`${row.label} allocated to ${col.label}`}
                        data-cell={`${row.id}-${col.id}`}
                        value={cells[row.id]?.[col.id] ?? ""}
                        onChange={(e) => onCellChange(row.id, col.id, e.target.value)}
                      />
                    </td>
                  ))}
                  <td
                    className="ns-cf-rowtotal"
                    tabIndex={0}
                    aria-label={`${row.label} total: ${formatCents(rowStated[ri], currency)}`}
                  >
                    {formatCents(rowStated[ri], currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="ns-cf-foot">
                <th scope="row" tabIndex={0}>
                  {footerLabel}
                </th>
                {columns.map((col, ci) => (
                  <td key={col.id} tabIndex={0} aria-label={`${col.label} allocated total: ${formatCents(colTotals[ci], currency)}`}>
                    {formatCents(colTotals[ci], currency)}
                  </td>
                ))}
                <td
                  ref={cornerRef}
                  className="ns-cf-corner"
                  data-closed={closed}
                  tabIndex={0}
                  aria-label={cornerLabel}
                >
                  <span className="ns-cf-corner-inner">
                    <span ref={headlineRef} className="ns-cf-corner-headline">
                      {formatCents(sumStated, currency)}
                    </span>
                    <span className="ns-cf-corner-status">{closed ? "Ledger closed" : `off by ${formatSigned(diffCents, currency)}`}</span>
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>

          <svg aria-hidden="true" className="ns-cf-rules" width={size.w} height={size.h}>
            <line className="ns-cf-rule" x1={0} y1={corner.y} x2={Math.max(0, corner.x - gapAnim / 2)} y2={corner.y} />
            <line className="ns-cf-rule" x1={corner.x} y1={0} x2={corner.x} y2={Math.max(0, corner.y - gapAnim / 2)} />
            {closed && corner.w > 0 ? (
              <g key={closedKey} className="ns-cf-double" data-anim="true">
                <line
                  className="ns-cf-double-line"
                  pathLength={1}
                  x1={corner.x + 4}
                  y1={headline.y + 4}
                  x2={corner.x + corner.w - 4}
                  y2={headline.y + 4}
                />
                <line
                  className="ns-cf-double-line"
                  pathLength={1}
                  x1={corner.x + 4}
                  y1={headline.y + 7}
                  x2={corner.x + corner.w - 4}
                  y2={headline.y + 7}
                />
              </g>
            ) : null}
          </svg>

          {!closed && corner.w > 0 ? (
            <div className="ns-cf-notch" style={{ left: notchX, top: notchY }}>
              {formatSigned(diffCents, currency)}
            </div>
          ) : null}
        </div>
      </div>

      <div aria-live="polite" className="sr-only">
        {liveMsg}
      </div>
    </div>
  );
}
