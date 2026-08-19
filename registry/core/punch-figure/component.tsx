"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// PunchFigure — an issued amount rendered as a checkwriter dot-matrix punch,
// not printed text. One governing scalar, the print head's column position,
// drives everything: which cells are cut through to reveal --background,
// the sheet's 1px translateY flinch on every step, and how much carriage
// travel remains. The head crosses the figure exactly once, left to right,
// at a firm 60ms/column — never faster (flinch would blur into vibration),
// never slower (it would read as labouring). There is no fade-in and no
// type-on: typing implies backspace, and the whole point of a punch is that
// material is REMOVED and cannot be put back. A committed figure can only
// ever be corrected by a second punched pass — a VOID stamp punched
// diagonally across it — which adds holes, never closes one.
//
// Real amount text lives in the accessible tree at all times (it does not
// wait on the animation); the dot grid is a decorative, aria-hidden replay
// of that same value. Issuing fires exactly one polite live-region
// announcement on completion. There is no interaction inside the mechanism
// itself — Issue and the confirm-gated Void are real buttons below it.
// prefers-reduced-motion renders the destination state in one paint, no
// column-by-column reveal and no flinch.
// ---------------------------------------------------------------------------

export interface PunchFigureProps {
  /** dollar amount to punch, e.g. 1180 -> "$1,180.00" */
  amount?: number;
  /** currency glyph prefixed onto the punched figure */
  currency?: string;
  /** shown in the header and folded into the issue/void announcements */
  invoiceId?: string;
  /** small caption above the figure, e.g. "Invoice", "Payout", "Credit note" */
  label?: string;
  /** called once the amount finishes punching through (or immediately, under reduced motion) */
  onIssue?: () => void;
  /** called once the VOID overpunch finishes (or immediately, under reduced motion) */
  onVoid?: () => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

// 5x7 dot-matrix font. Rows top-to-bottom, '#' = punched, '.' = paper.
// Only the glyphs a checkwriter amount (and a VOID overpunch) ever needs.
const FONT: Record<string, string[]> = {
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": [".###.", "#...#", "....#", "..##.", "....#", "#...#", ".###."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  ",": [".....", ".....", ".....", ".....", "..##.", "..#..", ".#..."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
};
const BLANK = [".....", ".....", ".....", ".....", ".....", ".....", "....."];

const STEP_MS = 60; // firm per-column cadence — see file header
const ARM_MS = 4000; // Void confirm-arm window before it disarms itself
const CELL = 5;
const GAP = 1.1;
const VOID_CELL = 7;
const VOID_GAP = 2;

interface ColumnLayout {
  /** rows[r][c] === true means glyph column c, row r is a punchable dot */
  rows: boolean[][];
  cols: number;
}

function buildColumns(text: string): ColumnLayout {
  const rows: boolean[][] = [[], [], [], [], [], [], []];
  const chars = [...text];
  chars.forEach((ch, i) => {
    const glyph = FONT[ch] ?? BLANK;
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) rows[r].push(glyph[r][c] === "#");
    }
    if (i < chars.length - 1) {
      for (let r = 0; r < 7; r++) rows[r].push(false); // one-column gap
    }
  });
  return { rows, cols: rows[0]?.length ?? 0 };
}

function formatAmount(amount: number, currency: string): string {
  const fixed = Math.abs(amount).toFixed(2);
  const [whole, cents] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${amount < 0 ? "-" : ""}${currency}${grouped}.${cents}`;
}

type Phase = "unissued" | "issuing" | "issued" | "voiding" | "voided";

function PunchGrid({
  layout,
  headCol,
  cell,
  gap,
}: {
  layout: ColumnLayout;
  headCol: number;
  cell: number;
  gap: number;
}) {
  const holes: React.ReactNode[] = [];
  const lastCol = Math.min(headCol, layout.cols - 1);
  for (let r = 0; r < 7; r++) {
    const row = layout.rows[r];
    for (let c = 0; c <= lastCol; c++) {
      if (row[c]) {
        holes.push(
          <span
            key={`${r}-${c}`}
            className="ns-pf-hole"
            style={{ gridColumn: c + 1, gridRow: r + 1 }}
          />
        );
      }
    }
  }
  return (
    <div
      className="ns-pf-grid"
      style={{
        gridTemplateColumns: `repeat(${layout.cols}, ${cell}px)`,
        gridTemplateRows: `repeat(7, ${cell}px)`,
        gap: `${gap}px`,
        width: layout.cols * cell + Math.max(0, layout.cols - 1) * gap,
        height: 7 * cell + 6 * gap,
      }}
    >
      {holes}
    </div>
  );
}

export function PunchFigure({
  amount = 1180,
  currency = "$",
  invoiceId = "INV-2041",
  label = "Invoice",
  onIssue,
  onVoid,
  className = "",
}: PunchFigureProps) {
  const autoId = useId().replace(/:/g, "");
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const reducedRef = useRef(false);
  const armTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onIssueRef = useRef(onIssue);
  onIssueRef.current = onIssue;
  const onVoidRef = useRef(onVoid);
  onVoidRef.current = onVoid;

  const [phase, setPhase] = useState<Phase>("unissued");
  const [headCol, setHeadCol] = useState(-1);
  const [voidHeadCol, setVoidHeadCol] = useState(-1);
  const [voidArmed, setVoidArmed] = useState(false);
  const [announce, setAnnounce] = useState("");

  const display = useMemo(() => formatAmount(amount, currency), [amount, currency]);
  const layout = useMemo(() => buildColumns(display), [display]);
  const voidLayout = useMemo(() => buildColumns("VOID"), []);

  // Reduced motion is decided before the browser ever paints: a
  // useLayoutEffect (not useEffect) so a reduced-motion visitor never sees
  // one frame of blank sheet before it jumps to fully punched — "at first
  // paint" is a layout-timing requirement, not just "skip the animation."
  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    if (mq.matches) {
      setHeadCol(layout.cols - 1);
      setPhase("issued");
    }
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => clearTimeout(armTimeoutRef.current), []);

  const flinch = useCallback(() => {
    const el = sheetRef.current;
    if (!el || reducedRef.current) return;
    el.classList.remove("ns-pf-flinch");
    void el.offsetWidth; // restart the CSS animation
    el.classList.add("ns-pf-flinch");
  }, []);

  // -- issuing pass: the head crosses the amount exactly once ---------------
  useEffect(() => {
    if (phase !== "issuing") return;
    let col = -1;
    const id = setInterval(() => {
      col += 1;
      setHeadCol(col);
      flinch();
      if (col >= layout.cols - 1) {
        clearInterval(id);
        setPhase("issued");
        setAnnounce(`Invoice ${invoiceId} issued for ${display}.`);
        onIssueRef.current?.();
      }
    }, STEP_MS);
    return () => clearInterval(id);
  }, [phase, layout.cols, flinch, invoiceId, display]);

  // -- void pass: a second head punches VOID on the diagonal, over the top --
  useEffect(() => {
    if (phase !== "voiding") return;
    let col = -1;
    const id = setInterval(() => {
      col += 1;
      setVoidHeadCol(col);
      flinch();
      if (col >= voidLayout.cols - 1) {
        clearInterval(id);
        setPhase("voided");
        setAnnounce(`Invoice ${invoiceId} voided.`);
        onVoidRef.current?.();
      }
    }, STEP_MS);
    return () => clearInterval(id);
  }, [phase, voidLayout.cols, flinch, invoiceId]);

  const handleIssue = useCallback(() => {
    if (phase !== "unissued") return;
    if (reducedRef.current) {
      setHeadCol(layout.cols - 1);
      setPhase("issued");
      setAnnounce(`Invoice ${invoiceId} issued for ${display}.`);
      onIssueRef.current?.();
      return;
    }
    setPhase("issuing");
  }, [phase, layout.cols, invoiceId, display]);

  const disarmVoid = useCallback(() => {
    clearTimeout(armTimeoutRef.current);
    setVoidArmed(false);
  }, []);

  const handleVoid = useCallback(() => {
    if (phase !== "issued") return;
    if (!voidArmed) {
      setVoidArmed(true);
      armTimeoutRef.current = setTimeout(() => setVoidArmed(false), ARM_MS);
      return;
    }
    disarmVoid();
    if (reducedRef.current) {
      setVoidHeadCol(voidLayout.cols - 1);
      setPhase("voided");
      setAnnounce(`Invoice ${invoiceId} voided.`);
      onVoidRef.current?.();
      return;
    }
    setPhase("voiding");
  }, [phase, voidArmed, disarmVoid, voidLayout.cols, invoiceId]);

  const handleVoidKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Escape" && voidArmed) {
        e.preventDefault();
        disarmVoid();
      }
    },
    [voidArmed, disarmVoid]
  );

  const travel = layout.cols > 1 ? Math.max(0, Math.min(1, (headCol + 1) / layout.cols)) : 0;

  const statusText: Record<Phase, string> = {
    unissued: "Not yet issued",
    issuing: "Issuing…",
    issued: "Issued",
    voiding: "Voiding…",
    voided: "Void",
  };

  const srSuffix =
    phase === "voided" ? " — VOID, does not settle." : phase === "unissued" || phase === "issuing" ? " (draft, not yet issued)" : "";

  return (
    <div className={`ns-pf-root w-full max-w-sm ${className}`}>
      <style>{CSS}</style>

      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </span>

      <div
        ref={sheetRef}
        className={`ns-pf-sheet relative overflow-hidden rounded-[16px] border border-border p-5 ${
          phase !== "unissued" ? "ns-pf-active" : ""
        }`}
        aria-hidden="true"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ns-muted">{label}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ns-muted">{invoiceId}</p>
        </div>

        <div className="ns-pf-mech relative mt-4">
          <PunchGrid layout={layout} headCol={headCol} cell={CELL} gap={GAP} />
          {(phase === "voiding" || phase === "voided") && (
            <div
              className="ns-pf-void-layer absolute left-1/2 top-1/2"
              style={{
                transform: `translate(-50%, -50%) rotate(-14deg)`,
              }}
            >
              <PunchGrid layout={voidLayout} headCol={voidHeadCol} cell={VOID_CELL} gap={VOID_GAP} />
            </div>
          )}
        </div>

        <div className="ns-pf-track mt-4">
          <div className="ns-pf-track-fill" style={{ width: `${travel * 100}%` }} />
          <div className="ns-pf-track-head" style={{ left: `${travel * 100}%` }} />
        </div>
      </div>

      <p id={`pf-amount-${autoId}`} className="sr-only">
        {label} {invoiceId}: {display}
        {srSuffix}
      </p>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="ns-pf-status-badge font-mono text-[11px] uppercase tracking-[0.12em] text-ns-muted">
          {statusText[phase]}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-pf-issue
            onClick={handleIssue}
            disabled={phase !== "unissued"}
            aria-describedby={`pf-amount-${autoId}`}
            className="ns-pf-btn"
          >
            {phase === "unissued" ? "Issue" : phase === "issuing" ? "Issuing…" : "Issued"}
          </button>
          <button
            type="button"
            data-pf-void
            onClick={handleVoid}
            onKeyDown={handleVoidKeyDown}
            onBlur={() => voidArmed && disarmVoid()}
            disabled={phase !== "issued"}
            className={`ns-pf-btn ${voidArmed ? "ns-pf-btn-armed" : ""}`}
          >
            {phase === "voided" ? "Voided" : phase === "voiding" ? "Voiding…" : voidArmed ? "Confirm void" : "Void"}
          </button>
        </div>
      </div>
    </div>
  );
}

const CSS = `
/* A hole is var(--background) showing through the sheet, so the sheet tint IS
   the contrast that makes the punched figure readable. At the original 4% the
   paper sat 4% off the hole colour and the whole figure rode on the 1px ring
   below — which, on a ~5px dot in --border, rendered the amount essentially
   invisible in the light theme (verified in light-open.png). 10% gives the
   paper a real edge against the void in both themes without turning the sheet
   into a filled block. */
.ns-pf-sheet{ background: color-mix(in oklab, var(--foreground) 10%, var(--background)); }
.ns-pf-grid{ position: relative; display: grid; }
.ns-pf-hole{
  background: var(--background);
  border-radius: 9999px;
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--foreground) 35%, transparent);
}
.ns-pf-void-layer{ opacity: 0.92; }
@keyframes ns-pf-flinch-kf{
  0%{ transform: translateY(0); }
  35%{ transform: translateY(1px); }
  70%{ transform: translateY(-0.3px); }
  100%{ transform: translateY(0); }
}
.ns-pf-flinch{ animation: ns-pf-flinch-kf 90ms ease-out; }

.ns-pf-track{ position: relative; height: 2px; border-radius: 9999px; background: color-mix(in oklab, var(--ns-muted) 30%, transparent); }
.ns-pf-track-fill{ position: absolute; inset: 0 auto 0 0; height: 100%; border-radius: 9999px; background: var(--border); transition: width 60ms linear; }
.ns-pf-track-head{ position: absolute; top: 50%; width: 3px; height: 8px; margin-left: -1.5px; border-radius: 1px; background: var(--foreground); transform: translateY(-50%); transition: left 60ms linear; }

.ns-pf-btn{
  border-radius: 9999px;
  border: 1px solid var(--border);
  background: var(--background);
  color: var(--foreground);
  padding: 0.4rem 0.9rem;
  font-size: 0.75rem;
  font-weight: 500;
  transition: border-color 150ms ease-out, color 150ms ease-out;
}
.ns-pf-btn:hover:not(:disabled){ border-color: var(--foreground); }
.ns-pf-btn:disabled{ color: var(--ns-muted); cursor: not-allowed; }
.ns-pf-btn:focus-visible{ outline: 2px solid var(--ns-accent); outline-offset: 2px; }
.ns-pf-btn-armed{ border-color: var(--ns-accent); color: var(--ns-accent); }

@media (prefers-reduced-motion: reduce){
  .ns-pf-flinch{ animation: none !important; }
  .ns-pf-track-fill, .ns-pf-track-head{ transition: none !important; }
  .ns-pf-btn{ transition: none !important; }
}
`;

export default PunchFigure;
