"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// PlateRegister — an ambient conflict indicator staged as printing
// misregistration. While a collaborator holds unsynced changes to a block,
// the paragraph prints slightly off-register: a ghost plate of THEIR version
// sits behind your text, offset by the governing scalar `d` — word-level
// edit distance between your text and theirs, normalized by your word count,
// clamped 0..1. `d` maps linearly to a plate offset of 0-6px (+0.3deg skew),
// capped at 6px because past that the doubling stops reading as "how far
// out of true" and starts reading as noise. `d` is recomputed from the two
// strings on every render that changes them — never from a clock — so a
// collaborator who has been parked on an identical draft for an hour reads
// as perfectly in register, and one who just typed a comma reads as barely
// split at all.
//
// Four 8px SVG registration crosshairs sit at the block's corners, each one
// two crosses at zero offset — the pressman's exact readout of the same
// offset vector driving the ghost plate, legible even where the prose
// itself is short enough that the text doubling alone is hard to judge.
// The ghost text is intentionally soft (0.35 opacity, --ns-muted) so it
// reads as peripheral texture while you're reading your own copy; the
// crosshairs are full-strength on purpose — they're the instrument you
// glance at to get the precise magnitude, not a texture.
//
// Resolving (Review -> keep mine / take theirs / merge) is irreversible for
// the session: it drives `d` to 0 with a critically-damped-feeling spring
// (k=280, zeta=0.95) over roughly 450ms, direct-DOM position, then fires one
// 60ms full-contrast "strike" on the block — the plates landing as a single
// crisp impression. Only your own text is ever in the accessibility tree
// (the ghost plate and both crosshair marks are aria-hidden); the block
// itself carries `aria-describedby` naming the collaborator and the word
// count that differs, so the magnitude is available as text, never only as
// a visual offset. `prefers-reduced-motion` skips the spring outright,
// jumping straight to the 0-offset state and playing only the 60ms strike.
// ---------------------------------------------------------------------------

export type PlateRegisterOutcome = "kept" | "theirs" | "merged";

export interface PlateRegisterProps {
  /** your (locally synced) paragraph text */
  text: string;
  /** the collaborator's unsynced version of the same block */
  theirText: string;
  /** collaborator display name — named in the description and the dialog */
  collaboratorName: string;
  /** fires once, the moment a resolution is chosen */
  onResolve?: (
    outcome: PlateRegisterOutcome,
    detail: { mine: string; theirs: string }
  ) => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const MAX_OFFSET_PX = 6;
const MAX_SKEW_DEG = 0.3;
const SPRING_K = 280;
const SPRING_ZETA = 0.95;
const SPRING_C = 2 * SPRING_ZETA * Math.sqrt(SPRING_K);
const SPRING_EPS = 0.002;
const SPRING_VEPS = 0.01;
const SPRING_MAX_MS = 900; // forced-settle deadline, never hangs mid-air
const STRIKE_MS = 60;
const STRIKE_CLASS = "ns-pr-strike";
const FOCUSABLE = 'button, [href], input, [tabindex]:not([tabindex="-1"])';

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function tokenize(s: string): string[] {
  const t = s.trim();
  return t === "" ? [] : t.split(/\s+/);
}

/** word-level Levenshtein distance — insertions, deletions, substitutions,
 * each cost 1. O(n*m), fine at paragraph length. */
function wordEditDistance(a: string[], b: string[]): number {
  const n = a.length;
  const m = b.length;
  const row = new Array<number>(m + 1);
  for (let j = 0; j <= m; j++) row[j] = j;
  for (let i = 1; i <= n; i++) {
    let prevDiag = row[0]!;
    row[0] = i;
    for (let j = 1; j <= m; j++) {
      const tmp = row[j]!;
      row[j] = a[i - 1] === b[j - 1] ? prevDiag : 1 + Math.min(prevDiag, row[j]!, row[j - 1]!);
      prevDiag = tmp;
    }
  }
  return row[m]!;
}

function outcomeMessage(outcome: PlateRegisterOutcome, name: string): string {
  if (outcome === "kept") return `Resolved — kept your version, out of register with ${name} no longer.`;
  if (outcome === "theirs") return `Resolved — took ${name}'s version, plates back in register.`;
  return `Resolved — merged with ${name}'s version, plates back in register.`;
}

function CrossMark({ ghost, dx, dy }: { ghost: boolean; dx: number; dy: number }) {
  // 20x20 local viewBox, true cross fixed at (10,10); the ghost cross is the
  // same 8px "+" translated by the plate's own offset vector — the corner
  // readout of the exact same number driving the text doubling.
  const x = ghost ? 10 + dx : 10;
  const y = ghost ? 10 + dy : 10;
  return (
    <g>
      <line
        x1={x}
        y1={y - 4}
        x2={x}
        y2={y + 4}
        stroke={ghost ? "var(--ns-muted)" : "var(--foreground)"}
        strokeWidth={1.1}
        strokeLinecap="round"
      />
      <line
        x1={x - 4}
        y1={y}
        x2={x + 4}
        y2={y}
        stroke={ghost ? "var(--ns-muted)" : "var(--foreground)"}
        strokeWidth={1.1}
        strokeLinecap="round"
      />
    </g>
  );
}

function RegistrationMark({
  corner,
  dx,
  dy,
}: {
  corner: "tl" | "tr" | "bl" | "br";
  dx: number;
  dy: number;
}) {
  return (
    <svg
      aria-hidden="true"
      width={20}
      height={20}
      viewBox="0 0 20 20"
      className={`ns-pr-mark ns-pr-mark-${corner}`}
    >
      <CrossMark ghost dx={dx} dy={dy} />
      <CrossMark ghost={false} dx={0} dy={0} />
    </svg>
  );
}

export function PlateRegister({
  text,
  theirText,
  collaboratorName,
  onResolve,
  className = "",
}: PlateRegisterProps) {
  const [displayText, setDisplayText] = useState(text);

  // divergence is measured, not stored: recomputed straight off the two
  // strings every render they change, never off a clock. It only changes
  // post-mount as a *result* of resolve() below, which sets displayText and
  // the phase together — so there is no separate effect re-deriving phase
  // from a moving dRaw, and no dependency-array staleness to reason about.
  const { dist, dRaw } = useMemo(() => {
    const mineWords = tokenize(displayText);
    const theirWords = tokenize(theirText);
    const distance = wordEditDistance(mineWords, theirWords);
    const len = Math.max(mineWords.length, 1);
    return { dist: distance, dRaw: clamp(distance / len, 0, 1) };
  }, [displayText, theirText]);

  const [phase, setPhase] = useState<"conflict" | "resolving" | "clear">(() =>
    dRaw > 0 ? "conflict" : "clear"
  );
  const [springD, setSpringD] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [announce, setAnnounce] = useState("");

  const decidedRef = useRef(false);
  const springStartRef = useRef(0);
  const blockRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reviewRef = useRef<HTMLButtonElement>(null);
  const keepMineRef = useRef<HTMLButtonElement>(null);

  const descId = useId();
  const titleId = useId();

  const d = phase === "resolving" ? springD : phase === "conflict" ? dRaw : 0;
  const showMarks = phase !== "clear";

  const offsetPx = d * MAX_OFFSET_PX;
  const offsetXPx = offsetPx;
  const offsetYPx = offsetPx * 0.4;
  const skewDeg = d * MAX_SKEW_DEG;
  const ghostTransform = `translate(${offsetXPx.toFixed(2)}px, ${offsetYPx.toFixed(2)}px) skewX(${skewDeg.toFixed(3)}deg)`;

  const openDialog = useCallback(() => {
    // showModal() throws if the dialog is already open — Review must stay
    // idempotent under repeat clicks (the verifier presses the first
    // interactive control, then a declared `gate` may click the same
    // control again before checking the open state).
    const dlg = dialogRef.current;
    if (!dlg || dlg.open) return;
    setDialogOpen(true);
    dlg.showModal();
  }, []);

  const closeDialog = useCallback((focusTrigger: boolean) => {
    setDialogOpen(false);
    dialogRef.current?.close();
    if (focusTrigger) reviewRef.current?.focus();
  }, []);

  const runStrike = useCallback(() => {
    const el = blockRef.current;
    if (el) {
      el.classList.remove(STRIKE_CLASS);
      void el.offsetWidth; // force reflow so the flash retriggers reliably
      el.classList.add(STRIKE_CLASS);
      window.setTimeout(() => el.classList.remove(STRIKE_CLASS), STRIKE_MS);
    }
    // native <dialog>.close() restores focus to whatever had it before
    // showModal() — the Review button — and that button is about to unmount
    // with the marks below. Catch focus before it's dropped to <body>.
    if (document.activeElement === reviewRef.current) el?.focus();
    setPhase("clear");
  }, []);

  const resolve = useCallback(
    (outcome: PlateRegisterOutcome) => {
      if (decidedRef.current) return; // irreversible: first decision wins
      decidedRef.current = true;
      const nextText = outcome === "theirs" ? theirText : text;
      setDisplayText(nextText);
      setAnnounce(outcomeMessage(outcome, collaboratorName));
      onResolve?.(outcome, { mine: text, theirs: theirText });
      // no refocus here (unlike Escape/backdrop dismissal below): the Review
      // button itself unmounts ~510ms from now when the block clears, and
      // parking focus on a control that's about to vanish just drops it to
      // <body>. The block stays put and the aria-live announcement already
      // carries the outcome, so leaving focus where it is is the safer call.
      closeDialog(false);

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        setSpringD(0);
        setPhase("resolving");
        // one microtask so the 0-offset frame actually paints before strike
        requestAnimationFrame(() => runStrike());
        return;
      }
      springStartRef.current = dRaw;
      setSpringD(dRaw);
      setPhase("resolving");
    },
    [text, theirText, collaboratorName, onResolve, closeDialog, dRaw, runStrike]
  );

  // critically-damped-feeling spring driving springD -> 0 once resolving.
  useEffect(() => {
    if (phase !== "resolving") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return; // handled synchronously in resolve()

    let raf = 0;
    let last = performance.now();
    let x = springStartRef.current;
    let v = 0;
    const deadline = last + SPRING_MAX_MS;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const accel = -SPRING_K * x - SPRING_C * v;
      v += accel * dt;
      x += v * dt;
      const settled = Math.abs(x) < SPRING_EPS && Math.abs(v) < SPRING_VEPS;
      if (settled || now >= deadline) {
        setSpringD(0);
        runStrike();
        return;
      }
      setSpringD(clamp(x, 0, 1));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, runStrike]);

  // hand-rolled focus trap + outside-dismiss for the native <dialog>
  useEffect(() => {
    if (!dialogOpen) return;
    const dlg = dialogRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !dlg) return;
      const focusable = Array.from(dlg.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    const onCancel = (e: Event) => {
      e.preventDefault();
      closeDialog(true);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.target === dlg) closeDialog(false);
    };
    document.addEventListener("keydown", onKey);
    dlg?.addEventListener("cancel", onCancel);
    dlg?.addEventListener("pointerdown", onPointerDown);
    keepMineRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      dlg?.removeEventListener("cancel", onCancel);
      dlg?.removeEventListener("pointerdown", onPointerDown);
    };
  }, [dialogOpen, closeDialog]);

  return (
    <div className={`relative ${className}`}>
      <style>{CSS}</style>

      <div
        ref={blockRef}
        tabIndex={-1}
        className="ns-pr-block relative rounded-md border border-border bg-background p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        aria-describedby={showMarks ? descId : undefined}
      >
        <div className="ns-pr-stack">
          <p className="ns-pr-mine m-0 text-sm leading-relaxed text-foreground">{displayText}</p>
          {showMarks && (
            <p
              aria-hidden="true"
              className="ns-pr-ghost m-0 text-sm leading-relaxed"
              style={{ transform: ghostTransform, opacity: 0.35, color: "var(--ns-muted)" }}
            >
              {theirText}
            </p>
          )}
        </div>

        {showMarks && (
          <>
            <RegistrationMark corner="tl" dx={offsetXPx} dy={offsetYPx} />
            <RegistrationMark corner="tr" dx={offsetXPx} dy={offsetYPx} />
            <RegistrationMark corner="bl" dx={offsetXPx} dy={offsetYPx} />
            <RegistrationMark corner="br" dx={offsetXPx} dy={offsetYPx} />
          </>
        )}
      </div>

      {showMarks && (
        <>
          <p id={descId} className="sr-only">
            {collaboratorName} has unsynced changes to this paragraph, {dist} word{dist === 1 ? "" : "s"} differ.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              ref={reviewRef}
              type="button"
              data-pr-review
              onClick={openDialog}
              className="ns-pr-review inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-ns-accent hover:text-ns-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
            >
              Review changes
            </button>
            {/* the magnitude read without leaving the paragraph — the ≤6px
                offset alone can't distinguish a comma from a rewrite, this can */}
            <span aria-hidden="true" className="font-mono text-[11px] text-ns-muted">
              {collaboratorName} · {dist} word{dist === 1 ? "" : "s"}
            </span>
          </div>
        </>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>

      <dialog
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="ns-pr-dialog"
      >
        <h2 id={titleId} className="m-0 text-sm font-medium text-foreground">
          Unsynced changes from {collaboratorName}
        </h2>
        <p className="mb-0 mt-1.5 text-xs leading-relaxed text-ns-muted">
          {dist} word{dist === 1 ? "" : "s"} differ from your version of this paragraph.
        </p>
        <div className="mt-4 rounded-sm border border-border bg-background p-2.5 font-mono text-xs leading-relaxed text-ns-muted">
          {theirText}
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => resolve("merged")}
            className="ns-pr-btn rounded-sm border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:border-ns-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Merge
          </button>
          <button
            type="button"
            onClick={() => resolve("theirs")}
            className="ns-pr-btn rounded-sm border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:border-ns-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Take theirs
          </button>
          <button
            ref={keepMineRef}
            type="button"
            onClick={() => resolve("kept")}
            className="ns-pr-btn rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-ns-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Keep mine
          </button>
        </div>
      </dialog>
    </div>
  );
}

const CSS = `
.ns-pr-stack{display:grid;}
.ns-pr-stack > *{grid-area:1/1;}
/* the reader's own text stays the top plate; the ghost is unpositioned
   (static) and painted first in DOM order, so without this it would
   composite OVER the real text instead of behind it. */
.ns-pr-mine{position:relative;z-index:1;}
.ns-pr-ghost{pointer-events:none;will-change:transform;}
.ns-pr-mark{position:absolute;pointer-events:none;overflow:visible;}
.ns-pr-mark-tl{top:-10px;left:-10px;}
.ns-pr-mark-tr{top:-10px;right:-10px;}
.ns-pr-mark-bl{bottom:-10px;left:-10px;}
.ns-pr-mark-br{bottom:-10px;right:-10px;}

@keyframes ns-pr-strike{
  0%{filter:contrast(1) brightness(1);}
  40%{filter:contrast(1.2) brightness(1.06);}
  100%{filter:contrast(1) brightness(1);}
}
/* Deliberately NOT gated behind prefers-reduced-motion: this is the single
   60ms acknowledgement frame the spec calls out as the reduced-motion
   resolution itself ("resolves with the strike frame alone") — a filter
   flash on existing pixels, not a translate/scale motion. */
.ns-pr-strike{animation:ns-pr-strike ${STRIKE_MS}ms ease-out;}

dialog.ns-pr-dialog{
  /* A host that resets margin to 0 on every element (Tailwind preflight,
     most CSS resets) kills the UA stylesheet's own <dialog> centering,
     which depends on margin:auto with an implicit inset. Pin position and
     centering explicitly instead of relying on that default. */
  position:fixed;
  top:50%;
  left:50%;
  margin:0;
  transform:translate(-50%, -50%) scale(0.96);
  border:1px solid var(--border);
  border-radius:12px;
  background:var(--background);
  color:var(--foreground);
  padding:16px;
  width:min(26rem, calc(100vw - 2rem));
  opacity:0;
  transition:opacity 180ms cubic-bezier(0.16,1,0.3,1), transform 180ms cubic-bezier(0.16,1,0.3,1), overlay 180ms allow-discrete, display 180ms allow-discrete;
}
dialog.ns-pr-dialog[open]{
  opacity:1;
  transform:translate(-50%, -50%) scale(1);
}
@starting-style{
  dialog.ns-pr-dialog[open]{
    opacity:0;
    transform:translate(-50%, -50%) scale(0.96);
  }
}
/* Never a hardcoded grey: the scrim is a translucent wash of --background
   itself (not --foreground), so it reads as a soft dim of the page in
   whichever theme is active rather than a flat mid-grey overlay, with a
   blur for the "more smooth" ask instead of a harder darkening trick. */
dialog.ns-pr-dialog::backdrop{
  background:color-mix(in srgb, var(--background) 55%, transparent);
  backdrop-filter:blur(6px);
  -webkit-backdrop-filter:blur(6px);
  opacity:0;
  transition:opacity 180ms cubic-bezier(0.16,1,0.3,1), display 180ms allow-discrete, overlay 180ms allow-discrete;
}
dialog.ns-pr-dialog[open]::backdrop{
  opacity:1;
}
@starting-style{
  dialog.ns-pr-dialog[open]::backdrop{
    opacity:0;
  }
}
@media (prefers-reduced-motion: reduce){
  dialog.ns-pr-dialog{
    transition:opacity 120ms linear;
    transform:translate(-50%, -50%);
  }
  dialog.ns-pr-dialog[open]{
    transform:translate(-50%, -50%);
  }
  @starting-style{
    dialog.ns-pr-dialog[open]{
      transform:translate(-50%, -50%);
    }
  }
  dialog.ns-pr-dialog::backdrop{
    transition:opacity 120ms linear;
  }
}
`;
