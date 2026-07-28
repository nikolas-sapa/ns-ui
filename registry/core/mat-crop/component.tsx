"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

// ---------------------------------------------------------------------------
// MatCrop — image cropping as a passe-partout: four mat boards slide over a
// photo to define the crop window, rather than a bounding-box overlay with
// dashed handles. Dragging any edge or corner moves that mat directly
// (1:1 with the pointer — a deliberate simplification of "paper friction",
// reserved below for the one place it's most visible); ratio presets snap
// the mats to the nearest valid rect at that ratio with a short, deliberately
// no-overshoot ease (standing in for "critically damped, no bounce" without
// a literal spring simulation). The exposed window shows a rule-of-thirds
// grid only while actively dragging.
// ---------------------------------------------------------------------------

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
  ratio: string;
}

export interface MatCropProps {
  onChange?: (rect: CropRect) => void;
  className?: string;
}

const DISPLAY_W = 480;
const DISPLAY_H = 300;
const NATURAL_SCALE = 4; // 1 display px = 4 "real photo" px, for a realistic readout
const MIN_SIZE = 60;

type Rect = { top: number; left: number; width: number; height: number };
type EdgeHandle = "top" | "right" | "bottom" | "left";
type CornerHandle = "tl" | "tr" | "bl" | "br";

const RATIO_PRESETS: { label: string; ratio: number | null }[] = [
  { label: "1:1", ratio: 1 },
  { label: "4:5", ratio: 4 / 5 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "Free", ratio: null },
];

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function ratioLabelFor(width: number, height: number): string {
  const r = width / height;
  for (const preset of RATIO_PRESETS) {
    if (preset.ratio && Math.abs(r - preset.ratio) < 0.02) return preset.label;
  }
  return "Free";
}

function fitRatio(current: Rect, ratio: number): Rect {
  const cx = current.left + current.width / 2;
  const cy = current.top + current.height / 2;
  let w = DISPLAY_W * 0.82;
  let h = w / ratio;
  if (h > DISPLAY_H * 0.82) {
    h = DISPLAY_H * 0.82;
    w = h * ratio;
  }
  const left = clamp(cx - w / 2, 0, DISPLAY_W - w);
  const top = clamp(cy - h / 2, 0, DISPLAY_H - h);
  return { top, left, width: w, height: h };
}

export function MatCrop({ onChange, className = "" }: MatCropProps) {
  const autoId = useId().replace(/:/g, "");
  const stageRef = useRef<HTMLDivElement | null>(null);
  const topMatRef = useRef<HTMLDivElement | null>(null);
  const rightMatRef = useRef<HTMLDivElement | null>(null);
  const bottomMatRef = useRef<HTMLDivElement | null>(null);
  const leftMatRef = useRef<HTMLDivElement | null>(null);
  const windowRef = useRef<HTMLDivElement | null>(null);
  const rectRef = useRef<Rect>({ top: 40, left: 60, width: 360, height: 220 });
  const dragRef = useRef<{ handle: EdgeHandle | CornerHandle; startX: number; startY: number; start: Rect } | null>(
    null
  );
  const reducedRef = useRef(false);

  const [rect, setRect] = useState<Rect>(rectRef.current);
  const [dragging, setDragging] = useState(false);
  const [activePreset, setActivePreset] = useState("Free");
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChangeMq = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChangeMq);
    return () => mq.removeEventListener("change", onChangeMq);
  }, []);

  const paint = useCallback((r: Rect, animate: boolean) => {
    const ms = animate && !reducedRef.current ? 180 : 0;
    const ease = "cubic-bezier(0.2, 0.75, 0.25, 1)"; // no-overshoot ease-out
    const apply = (el: HTMLElement | null, styles: Partial<CSSStyleDeclaration>) => {
      if (!el) return;
      el.style.transition = ms > 0 ? `top ${ms}ms ${ease}, left ${ms}ms ${ease}, right ${ms}ms ${ease}, bottom ${ms}ms ${ease}, width ${ms}ms ${ease}, height ${ms}ms ${ease}` : "none";
      Object.assign(el.style, styles);
    };
    apply(topMatRef.current, { height: `${r.top}px` });
    apply(bottomMatRef.current, { top: `${r.top + r.height}px`, height: `${DISPLAY_H - r.top - r.height}px` });
    apply(leftMatRef.current, { top: `${r.top}px`, height: `${r.height}px`, width: `${r.left}px` });
    apply(rightMatRef.current, {
      top: `${r.top}px`,
      height: `${r.height}px`,
      left: `${r.left + r.width}px`,
      width: `${DISPLAY_W - r.left - r.width}px`,
    });
    apply(windowRef.current, { top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px` });
  }, []);

  const commit = useCallback(
    (r: Rect, animate: boolean) => {
      rectRef.current = r;
      setRect(r);
      paint(r, animate);
      const label = ratioLabelFor(r.width, r.height);
      setActivePreset(label);
      onChange?.({
        x: Math.round(r.left * NATURAL_SCALE),
        y: Math.round(r.top * NATURAL_SCALE),
        width: Math.round(r.width * NATURAL_SCALE),
        height: Math.round(r.height * NATURAL_SCALE),
        ratio: label,
      });
    },
    [onChange, paint]
  );

  useEffect(() => {
    paint(rectRef.current, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPreset = useCallback(
    (label: string, ratio: number | null) => {
      const next = ratio ? fitRatio(rectRef.current, ratio) : rectRef.current;
      commit(next, true);
      setAnnounce(`Crop set to ${label}.`);
    },
    [commit]
  );

  const onEdgePointerDown = useCallback((handle: EdgeHandle | CornerHandle) => (e: ReactPointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { handle, startX: e.clientX, startY: e.clientY, start: { ...rectRef.current } };
    setDragging(true);
  }, []);

  const onEdgePointerMove = useCallback(
    (e: ReactPointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const s = drag.start;
      let { top, left, width, height } = s;

      const adjustTop = () => {
        const newTop = clamp(s.top + dy, 0, s.top + s.height - MIN_SIZE);
        height = s.height - (newTop - s.top);
        top = newTop;
      };
      const adjustBottom = () => {
        height = clamp(s.height + dy, MIN_SIZE, DISPLAY_H - s.top);
      };
      const adjustLeft = () => {
        const newLeft = clamp(s.left + dx, 0, s.left + s.width - MIN_SIZE);
        width = s.width - (newLeft - s.left);
        left = newLeft;
      };
      const adjustRight = () => {
        width = clamp(s.width + dx, MIN_SIZE, DISPLAY_W - s.left);
      };

      if (drag.handle === "top" || drag.handle === "tl" || drag.handle === "tr") adjustTop();
      if (drag.handle === "bottom" || drag.handle === "bl" || drag.handle === "br") adjustBottom();
      if (drag.handle === "left" || drag.handle === "tl" || drag.handle === "bl") adjustLeft();
      if (drag.handle === "right" || drag.handle === "tr" || drag.handle === "br") adjustRight();

      const next = { top, left, width, height };
      rectRef.current = next;
      paint(next, false);
      setRect(next);
    },
    [paint]
  );

  const onEdgePointerUp = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    commit(rectRef.current, false);
  }, [commit]);

  const nudge = useCallback(
    (handle: EdgeHandle, deltaPx: number) => {
      const s = rectRef.current;
      let { top, left, width, height } = s;
      if (handle === "top") {
        const newTop = clamp(s.top + deltaPx, 0, s.top + s.height - MIN_SIZE);
        height = s.height - (newTop - s.top);
        top = newTop;
      } else if (handle === "bottom") {
        height = clamp(s.height + deltaPx, MIN_SIZE, DISPLAY_H - s.top);
      } else if (handle === "left") {
        const newLeft = clamp(s.left + deltaPx, 0, s.left + s.width - MIN_SIZE);
        width = s.width - (newLeft - s.left);
        left = newLeft;
      } else {
        width = clamp(s.width + deltaPx, MIN_SIZE, DISPLAY_W - s.left);
      }
      commit({ top, left, width, height }, false);
    },
    [commit]
  );

  const onSliderKeyDown = useCallback(
    (handle: EdgeHandle) => (e: ReactKeyboardEvent) => {
      const step = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        nudge(handle, -step);
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        nudge(handle, step);
      }
    },
    [nudge]
  );

  const readout = useMemo(() => {
    const w = Math.round(rect.width * NATURAL_SCALE);
    const h = Math.round(rect.height * NATURAL_SCALE);
    return `${w} x ${h} — ${activePreset}`;
  }, [rect, activePreset]);

  const edgeAria = (handle: EdgeHandle, label: string, value: number, max: number) => ({
    role: "slider" as const,
    tabIndex: 0,
    "aria-label": label,
    "aria-valuemin": 0,
    "aria-valuemax": Math.round(max * NATURAL_SCALE),
    "aria-valuenow": Math.round(value * NATURAL_SCALE),
    onKeyDown: onSliderKeyDown(handle),
  });

  return (
    <div className={`w-full max-w-md ${className}`}>
      <style>{CSS}</style>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </span>

      <div
        ref={stageRef}
        className="ns-mc-stage relative select-none overflow-hidden rounded-[12px] border border-border"
        style={{ width: DISPLAY_W, height: DISPLAY_H }}
        onPointerMove={onEdgePointerMove}
        onPointerUp={onEdgePointerUp}
        onPointerCancel={onEdgePointerUp}
      >
        <img src={PHOTO_SRC} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full" />

        {/* rule-of-thirds grid, visible only while dragging */}
        <div
          ref={windowRef}
          aria-hidden="true"
          className={`ns-mc-window pointer-events-none absolute ${dragging ? "ns-mc-grid" : ""}`}
        />

        {/* mat boards */}
        <div ref={topMatRef} className="ns-mc-mat absolute inset-x-0 top-0 border-b border-border bg-background" />
        <div ref={bottomMatRef} className="ns-mc-mat absolute inset-x-0 border-t border-border bg-background" />
        <div ref={leftMatRef} className="ns-mc-mat absolute left-0 border-r border-border bg-background" />
        <div ref={rightMatRef} className="ns-mc-mat absolute border-l border-border bg-background" />

        {/* edge grip strips — drag + keyboard sliders */}
        <div
          {...edgeAria("top", "Top edge", rect.top, DISPLAY_H)}
          onPointerDown={onEdgePointerDown("top")}
          className="ns-mc-grip ns-mc-grip-h absolute inset-x-0 cursor-ns-resize"
          style={{ top: rect.top - 4 }}
        />
        <div
          {...edgeAria("bottom", "Bottom edge", DISPLAY_H - rect.top - rect.height, DISPLAY_H)}
          onPointerDown={onEdgePointerDown("bottom")}
          className="ns-mc-grip ns-mc-grip-h absolute inset-x-0 cursor-ns-resize"
          style={{ top: rect.top + rect.height - 4 }}
        />
        <div
          {...edgeAria("left", "Left edge", rect.left, DISPLAY_W)}
          onPointerDown={onEdgePointerDown("left")}
          className="ns-mc-grip ns-mc-grip-v absolute inset-y-0 cursor-ew-resize"
          style={{ left: rect.left - 4 }}
        />
        <div
          {...edgeAria("right", "Right edge", DISPLAY_W - rect.left - rect.width, DISPLAY_W)}
          onPointerDown={onEdgePointerDown("right")}
          className="ns-mc-grip ns-mc-grip-v absolute inset-y-0 cursor-ew-resize"
          style={{ left: rect.left + rect.width - 4 }}
        />

        {/* corner handles */}
        {(
          [
            ["tl", rect.left - 5, rect.top - 5, "nwse-resize"],
            ["tr", rect.left + rect.width - 5, rect.top - 5, "nesw-resize"],
            ["bl", rect.left - 5, rect.top + rect.height - 5, "nesw-resize"],
            ["br", rect.left + rect.width - 5, rect.top + rect.height - 5, "nwse-resize"],
          ] as [CornerHandle, number, number, string][]
        ).map(([handle, left, top, cursor]) => (
          <div
            key={handle}
            aria-hidden="true"
            onPointerDown={onEdgePointerDown(handle)}
            className="ns-mc-corner absolute h-2.5 w-2.5"
            style={{ left, top, cursor }}
          />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex gap-1.5" role="group" aria-label="Crop ratio presets">
          {RATIO_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p.label, p.ratio)}
              aria-pressed={activePreset === p.label}
              className={`rounded-[6px] border px-2.5 py-1 font-mono text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                activePreset === p.label
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted hover:border-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className={`ns-mc-readout-${autoId} font-mono text-xs text-muted`}>{readout}</p>
      </div>
    </div>
  );
}

// Abstract monochrome placeholder "photo" (mountains + sun), fixed content
// tones — a photo's own pixels aren't chrome, so they're exempt from the
// theme-token rule the surrounding UI follows.
const PHOTO_SRC = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300" viewBox="0 0 480 300"><rect width="480" height="300" fill="#3a3a3a"/><circle cx="380" cy="70" r="34" fill="#565656"/><polygon points="0,300 140,140 230,230 300,120 480,300" fill="#2a2a2a"/><polygon points="0,300 90,200 180,300" fill="#232323"/></svg>'
)}`;

const CSS = `
.ns-mc-mat{ box-shadow: inset 0 0 10px rgba(0,0,0,0.35); }
.ns-mc-window.ns-mc-grid::before, .ns-mc-window.ns-mc-grid::after{ content:""; position:absolute; background: rgba(255,255,255,0.35); }
.ns-mc-window::before{ left: 33.333%; top:0; bottom:0; width:1px; }
.ns-mc-window::after{ left: 66.666%; top:0; bottom:0; width:1px; }
.ns-mc-grip{ z-index: 5; }
.ns-mc-grip-h{ height: 8px; }
.ns-mc-grip-v{ width: 8px; }
.ns-mc-grip-h::after{ content:""; position:absolute; left:0; right:0; top:50%; height:0; border-top: 2px solid transparent; transform: translateY(-1px); }
.ns-mc-grip-v::after{ content:""; position:absolute; top:0; bottom:0; left:50%; width:0; border-left: 2px solid transparent; transform: translateX(-1px); }
.ns-mc-grip:hover.ns-mc-grip-h::after, .ns-mc-grip:focus-visible.ns-mc-grip-h::after{ border-top-color: var(--accent); }
.ns-mc-grip:hover.ns-mc-grip-v::after, .ns-mc-grip:focus-visible.ns-mc-grip-v::after{ border-left-color: var(--accent); }
.ns-mc-grip:focus-visible{ outline: none; }
.ns-mc-corner{ z-index: 6; }
.ns-mc-corner:hover{ background: var(--accent); border-radius: 9999px; }
@media (prefers-reduced-motion: reduce){
  .ns-mc-mat, .ns-mc-window{ transition: none !important; }
}
`;

export default MatCrop;
