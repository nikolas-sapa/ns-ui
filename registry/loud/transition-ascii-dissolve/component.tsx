"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// AsciiDissolveTransition — a layout transition whose seam is a SPATIAL
// dissolve front, not a per-character identity churn. Two full panels sit
// stacked: the outgoing `from` panel on top, hard-clipped at a front
// position; the incoming `to` panel underneath, always full. A canvas veil
// layered above both draws a band of ASCII glyph noise centered exactly on
// the front, density falling off with distance from it — the outgoing
// panel visibly frays into noise on the side not yet swept, and the
// incoming panel visibly resolves out of that same noise on the side
// already swept. The front's position is a real, continuously draggable
// value (mouse, touch or keyboard) — there is no autoplay-only, one-shot
// "reveal" here: dragging it back un-sweeps the transition exactly as far
// as you pull it, because both the CSS clip and the noise band are pure
// functions of the current front value, not of a play/finished state
// machine. That reversibility is what keeps this a spatial transition
// mechanic instead of the scramble-text restyle this registry holds a
// standing position against (text-decrypt, background-ascii-dither already
// own "characters churn in place").
//
// Distinct from text-decrypt / text-ascii-cascade (identity churn or
// physical fall of a STRING's own characters, no front, no drag, one-shot),
// scroll-defrost (a shader anneal driven by scroll with no discrete
// draggable front and no second DOM panel underneath), and
// transition-panel-crumble (a full-screen physics pour between two REAL
// panels, gravity-timed and irreversible once triggered — this component's
// front is a live, bidirectional value the user parks anywhere, not a
// particle simulation that plays once).
// ---------------------------------------------------------------------------

export interface AsciiDissolveTransitionProps {
  /** outgoing content, visible where the front hasn't swept yet */
  from: ReactNode;
  /** incoming content, visible where the front has already swept */
  to: ReactNode;
  /** controlled front position, 0 (all `from`) .. 1 (all `to`) */
  value?: number;
  /** initial front position when uncontrolled. Default 0.35 */
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  label?: string;
  className?: string;
}

const CELL = 12;
const BAND_PX = 90;
const CHARSET = "░▒▓█#%@*+=-:. ";

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

interface Tokens {
  fg: string;
  muted: string;
  border: string;
  accent: string;
}

function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    fg: get("--foreground", "#171717"),
    muted: get("--muted", "#4d4d4d"),
    border: get("--border", "#ebebeb"),
    accent: get("--accent", "#006bff"),
  };
}

function useTokens(): Tokens {
  const [tokens, setTokens] = useState<Tokens>(() =>
    typeof document === "undefined"
      ? { fg: "#171717", muted: "#4d4d4d", border: "#ebebeb", accent: "#006bff" }
      : readTokens()
  );
  useEffect(() => {
    const sync = () => setTokens(readTokens());
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    return () => mo.disconnect();
  }, []);
  return tokens;
}

function randomGlyph(): string {
  return CHARSET[Math.floor(Math.random() * CHARSET.length)];
}

export function AsciiDissolveTransition({
  from,
  to,
  value,
  defaultValue = 0.35,
  onValueChange,
  label = "Dissolve transition",
  className = "",
}: AsciiDissolveTransitionProps) {
  const uid = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tokens = useTokens();

  const isControlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue);
  const front = isControlled ? (value as number) : inner;

  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  function commit(next: number) {
    const clamped = Math.max(0, Math.min(1, next));
    if (!isControlled) setInner(clamped);
    onValueChange?.(clamped);
  }

  function posFromClientX(clientX: number): number {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return front;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    commit(posFromClientX(e.clientX));
  }
  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragging) commit(posFromClientX(e.clientX));
  }
  function endDrag() {
    setDragging(false);
  }
  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    let next = front;
    if (e.key === "ArrowLeft") next -= 0.02;
    else if (e.key === "ArrowRight") next += 0.02;
    else if (e.key === "PageDown") next -= 0.1;
    else if (e.key === "PageUp") next += 0.1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 1;
    else return;
    e.preventDefault();
    commit(next);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = wrap.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cols = Math.ceil(w / CELL);
    const rows = Math.ceil(h / CELL);
    const frontX = front * w;

    let raf = 0;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const cx = gx * CELL + CELL / 2;
          const cy = gy * CELL + CELL / 2;
          const dist = Math.abs(cx - frontX);
          if (dist > BAND_PX) continue;
          const density = 1 - smoothstep(dist / BAND_PX);
          if (density < 0.02) continue;
          ctx.globalAlpha = density;
          ctx.fillStyle = dist < BAND_PX * 0.18 ? tokens.accent : tokens.fg;
          ctx.font = `${CELL - 2}px "GeistMono", ui-monospace, monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(randomGlyph(), cx, cy);
        }
      }
      ctx.globalAlpha = 1;

      // seam line
      ctx.strokeStyle = tokens.accent;
      ctx.lineWidth = dragging || focused ? 2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.round(frontX) + 0.5, 0);
      ctx.lineTo(Math.round(frontX) + 0.5, h);
      ctx.stroke();

      // churn continues only while the front is actively being interacted
      // with (dragged or keyboard-focused); otherwise one frozen frame
      // stands, matching reduced-motion behavior and keeping this cheap at
      // rest.
      if (!reducedRef.current && (dragging || focused)) {
        raf = requestAnimationFrame(draw);
      }
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [tokens, front, dragging, focused]);

  return (
    <div
      ref={wrapRef}
      className={`ns-tad relative overflow-hidden rounded-sm border border-border ${className}`}
    >
      <style>{CSS}</style>

      {/* incoming panel — always full, sits underneath */}
      <div className="absolute inset-0" aria-hidden={front < 0.5}>
        {to}
      </div>

      {/* outgoing panel — hard-clipped to the unswept region */}
      <div
        className="absolute inset-0"
        aria-hidden={front >= 0.5}
        style={{ clipPath: `inset(0 0 0 ${front * 100}%)` }}
      >
        {from}
      </div>

      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />

      <div
        id={`${uid}-handle`}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(front * 100)}
        aria-valuetext={`${Math.round(front * 100)}% resolved`}
        aria-orientation="horizontal"
        className="ns-tad-handle absolute inset-0 cursor-col-resize touch-none outline-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setDragging(false);
        }}
      />
    </div>
  );
}

const CSS = `
.ns-tad-handle:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.ns-tad-handle:hover { background: linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--accent) 8%, transparent) 50%, transparent 100%); }
`;
