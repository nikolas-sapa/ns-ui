"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// DeedStroke — signature capture as consent, not a checkbox tick (see
// checkbox-ink-stroke for that). A canvas ink layer renders pointer strokes with
// pen-pressure feel (velocity maps inversely to line width, a pooled dab at
// every stroke start), backed by a baseline guide div. On release, a
// "witness" replay retraces the captured points once at a constant pace so
// the signer sees their mark rendered cleanly, then Confirm unlocks —
// confirming embosses the strip (inset shadow + caption swap to
// "Authorized"). Clear resets. A keyboard/no-pointer path lets the signer
// type their name instead, styled as an italic mark, which skips the replay
// (there is nothing to smooth) and unlocks Confirm as soon as it is non-empty.
//
// All ink drawing is direct 2D-canvas calls driven by refs — no React state
// on the draw or replay hot path. Hover reveals a two-tone nib-dot CSS
// cursor (visible on any theme, no JS pointer tracking needed) and brightens
// the baseline guide via a plain CSS :hover rule.
// ---------------------------------------------------------------------------

export interface DeedStrokeValue {
  mode: "draw" | "type";
  dataUrl?: string;
  name?: string;
}

export interface DeedStrokeProps {
  /** Caption shown before signing. Default "Sign to authorize". */
  prompt?: string;
  /** Called once, when the signer confirms. */
  onConfirm?: (value: DeedStrokeValue) => void;
  className?: string;
}

type Point = { x: number; y: number; t: number };
type Stroke = Point[];

const MIN_WIDTH = 1.1;
const MAX_WIDTH = 4.4;
const VELOCITY_SCALE = 0.09; // px/ms -> width falloff
const POOL_RADIUS = MAX_WIDTH * 0.95;
const REPLAY_MS = 650;
const REPLAY_WIDTH = 1.8;
const MIN_POINTS_TO_SIGN = 2;

// Two-tone dot (dark center, light ring) reads on any theme without CSS
// variables — cursor images can't resolve custom properties.
const NIB_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><circle cx="5" cy="5" r="4" fill="%23f5f5f5" stroke="%23171717" stroke-width="1"/><circle cx="5" cy="5" r="1.5" fill="%23171717"/></svg>'
)}") 5 5, crosshair`;

function resolveInk(canvas: HTMLCanvasElement): string {
  return getComputedStyle(canvas).color || "#ededed";
}

function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function strokeSegment(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  width: number,
  color: string
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function drawPool(ctx: CanvasRenderingContext2D, p: Point, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, POOL_RADIUS, 0, Math.PI * 2);
  ctx.fill();
}

export function DeedStroke({ prompt = "Sign to authorize", onConfirm, className = "" }: DeedStrokeProps) {
  const autoId = useId().replace(/:/g, "");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const inkColorRef = useRef("#ededed");
  const reducedRef = useRef(false);
  const replayFrameRef = useRef<number | undefined>(undefined);

  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typedName, setTypedName] = useState("");
  const [hasStroke, setHasStroke] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [canConfirm, setCanConfirm] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => () => {
    if (replayFrameRef.current) cancelAnimationFrame(replayFrameRef.current);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const reset = useCallback(() => {
    if (replayFrameRef.current) cancelAnimationFrame(replayFrameRef.current);
    strokesRef.current = [];
    lastPointRef.current = null;
    drawingRef.current = false;
    clearCanvas();
    setHasStroke(false);
    setReplaying(false);
    setCanConfirm(false);
    setConfirmed(false);
    setTypedName("");
    setAnnounce("Signature cleared.");
  }, [clearCanvas]);

  // Retrace every captured point once at a constant pace, redrawing the
  // whole path-so-far each frame (a signature is a few hundred points at
  // most — cheap to redraw wholesale, and it sidesteps incremental-segment
  // bookkeeping across the pen-up gaps between strokes).
  const runWitnessReplay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const strokes = strokesRef.current;
    const color = inkColorRef.current;

    type Seg = { a: Point; b: Point; len: number };
    const segments: Seg[] = [];
    let total = 0;
    for (const stroke of strokes) {
      for (let i = 1; i < stroke.length; i++) {
        const len = distance(stroke[i - 1]!, stroke[i]!);
        segments.push({ a: stroke[i - 1]!, b: stroke[i]!, len });
        total += len;
      }
    }
    if (total === 0) {
      setCanConfirm(true);
      setReplaying(false);
      return;
    }

    setReplaying(true);
    const start = performance.now();

    const frame = (now: number) => {
      const fraction = Math.min(1, (now - start) / REPLAY_MS);
      clearCanvas();
      let budget = total * fraction;
      for (const seg of segments) {
        if (budget <= 0) break;
        if (seg.len <= budget) {
          strokeSegment(ctx, seg.a, seg.b, REPLAY_WIDTH, color);
          budget -= seg.len;
        } else {
          const t = seg.len === 0 ? 0 : budget / seg.len;
          const bx = seg.a.x + (seg.b.x - seg.a.x) * t;
          const by = seg.a.y + (seg.b.y - seg.a.y) * t;
          strokeSegment(ctx, seg.a, { x: bx, y: by, t: seg.a.t }, REPLAY_WIDTH, color);
          budget = 0;
        }
      }
      if (fraction < 1) {
        replayFrameRef.current = requestAnimationFrame(frame);
      } else {
        setReplaying(false);
        setCanConfirm(true);
        setAnnounce("Signature captured. Ready to confirm.");
      }
    };
    replayFrameRef.current = requestAnimationFrame(frame);
  }, [clearCanvas]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (confirmed || replaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    inkColorRef.current = resolveInk(canvas);
    const rect = canvas.getBoundingClientRect();
    const p: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top, t: performance.now() };
    drawingRef.current = true;
    strokesRef.current.push([p]);
    lastPointRef.current = p;
    const ctx = canvas.getContext("2d");
    if (ctx) drawPool(ctx, p, inkColorRef.current);
  }, [confirmed, replaying]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const last = lastPointRef.current;
    if (!canvas || !last) return;
    const rect = canvas.getBoundingClientRect();
    const p: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top, t: performance.now() };
    const dt = Math.max(1, p.t - last.t);
    const dist = distance(last, p);
    const velocity = dist / dt;
    const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, MAX_WIDTH - velocity / VELOCITY_SCALE));
    const ctx = canvas.getContext("2d");
    if (ctx) strokeSegment(ctx, last, p, width, inkColorRef.current);
    strokesRef.current[strokesRef.current.length - 1]?.push(p);
    lastPointRef.current = p;
  }, []);

  const finishStroke = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    const totalPoints = strokesRef.current.reduce((n, s) => n + s.length, 0);
    const signed = totalPoints >= MIN_POINTS_TO_SIGN;
    setHasStroke(signed);
    if (!signed) return;
    if (reducedRef.current) {
      setCanConfirm(true);
      setAnnounce("Signature captured. Ready to confirm.");
    } else {
      runWitnessReplay();
    }
  }, [runWitnessReplay]);

  const handleConfirm = useCallback(() => {
    if (!canConfirm || confirmed) return;
    setConfirmed(true);
    setAnnounce("Authorized.");
    if (mode === "draw") {
      onConfirm?.({ mode, dataUrl: canvasRef.current?.toDataURL() });
    } else {
      onConfirm?.({ mode, name: typedName.trim() });
    }
  }, [canConfirm, confirmed, mode, onConfirm, typedName]);

  const toggleMode = useCallback(() => {
    if (confirmed) return;
    setMode((m) => (m === "draw" ? "type" : "draw"));
    reset();
  }, [confirmed, reset]);

  const nameId = `signature-consent-name-${autoId}`;
  const captionText = confirmed ? "Authorized" : prompt;
  const drawReady = mode === "draw" && canConfirm && !confirmed;
  const typeReady = mode === "type" && typedName.trim().length > 0 && !confirmed;
  const confirmEnabled = drawReady || typeReady;

  return (
    <div className={`w-full max-w-md rounded-[12px] border border-border bg-background ${className}`}>
      <style>{CSS}</style>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </span>

      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">{captionText}</p>
        <button
          type="button"
          onClick={toggleMode}
          disabled={confirmed}
          className="ns-ds-link font-mono text-[11px] text-ns-muted underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          {mode === "draw" ? "Type your name instead" : "Draw signature instead"}
        </button>
      </div>

      <div className="px-5 py-6">
        {mode === "draw" ? (
          <div
            className={`ns-ds-area relative h-32 w-full overflow-hidden rounded-[6px] border border-border transition-shadow duration-200 ${
              confirmed ? "ns-ds-embossed" : ""
            }`}
          >
            <div aria-hidden="true" className="ns-ds-baseline absolute inset-x-4 bottom-9 h-px bg-ns-muted" />
            <canvas
              ref={canvasRef}
              width={352}
              height={128}
              role="img"
              aria-label={confirmed ? "Authorized signature" : "Signature pad — draw with your pointer"}
              className="ns-ds-canvas relative h-32 w-full touch-none text-foreground"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={finishStroke}
              onPointerLeave={finishStroke}
              onPointerCancel={finishStroke}
              style={{ cursor: confirmed || replaying ? "default" : NIB_CURSOR }}
            />
            {!hasStroke && !replaying && (
              <p
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-2 text-center font-mono text-[10px] uppercase tracking-widest text-ns-muted"
              >
                Draw here
              </p>
            )}
          </div>
        ) : (
          <div>
            <label htmlFor={nameId} className="sr-only">
              Type your name
            </label>
            <input
              id={nameId}
              type="text"
              value={typedName}
              disabled={confirmed}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Type your name"
              autoComplete="name"
              className={`ns-ds-name-input w-full rounded-[6px] border border-border bg-transparent px-3 py-4 text-2xl text-foreground placeholder:text-ns-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent ${
                confirmed ? "ns-ds-embossed" : ""
              }`}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={reset}
          disabled={!hasStroke && typedName.length === 0 && !confirmed}
          className="font-mono text-xs text-ns-muted underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!confirmEnabled}
          className="rounded-[6px] border border-border bg-foreground px-4 py-1.5 font-mono text-xs text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-ns-muted disabled:opacity-60"
        >
          {confirmed ? "Authorized" : "Confirm"}
        </button>
      </div>
    </div>
  );
}

const CSS = `
.ns-ds-area:hover .ns-ds-baseline{ background: var(--foreground); }
.ns-ds-embossed{
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.45), inset 0 -1px 0 rgba(255,255,255,0.04);
  transition: box-shadow 200ms ease-out;
}
@media (prefers-reduced-motion: reduce){
  .ns-ds-embossed{ transition: none; }
}
`;

export default DeedStroke;
