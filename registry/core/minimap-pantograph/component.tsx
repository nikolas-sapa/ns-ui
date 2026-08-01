"use client";

import { useEffect, useRef, type ReactNode } from "react";

// ScissorReach — a minimap whose viewport rectangle is physically wired to
// the real viewport by a live SVG pantograph. The minimap is a scaled clone
// of the same content (CSS transform: scale, never re-measured — width and
// height ratios are derived once from the fixed contentWidth/contentHeight
// props). Between the minimap's viewport rect and the real viewport's
// top-left corner, two mirrored 2-bar elbow arms are solved every frame by
// trivial IK from the two live anchor points; only the elbow (joint)
// springs — the anchors themselves track their DOM elements exactly, never
// lagging, so the linkage always reads as physically attached rather than
// floating. Direct-DOM rAF, refs only on the hot path, sleeps when the
// spring settles and dragging has stopped.

type Vec = { x: number; y: number };

const BOW = 26; // px — arm reach exceeds half the anchor span by this much
const SPRING_K = 200; // s^-2
const SPRING_ZETA = 0.8; // slightly underdamped -> a hair of catch-up snap
const SPRING_C = 2 * SPRING_ZETA * Math.sqrt(SPRING_K);
const SETTLE_EPS = 0.15; // px
const SETTLE_V_EPS = 2; // px/s
const IDLE_MS = 700; // idle relax delay before the linkage fades to 0.3
const STEP_X = 32; // px per ArrowLeft/Right, content space

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

// Two equal-length links whose combined reach is fixed at (d/2 + bow) for
// the current anchor distance d — always solvable (no negative sqrt), and
// the bow shrinks as a fraction of d as the anchors pull apart, which reads
// as "the linkage extends and flattens" rather than a floppy fixed arm.
function twoBarElbow(a: Vec, b: Vec, bow: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.max(1e-4, Math.hypot(dx, dy));
  const link = d / 2 + bow;
  const h = Math.sqrt(Math.max(0, link * link - (d / 2) * (d / 2)));
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const nx = -dy / d;
  const ny = dx / d;
  return {
    up: { x: mx + nx * h, y: my + ny * h },
    down: { x: mx - nx * h, y: my - ny * h },
  };
}

export function ScissorReach({
  children,
  contentWidth,
  contentHeight,
  minimapWidth = 140,
  minimapHeight = 220,
  viewportHeight = 340,
  rowHeight = 16,
  unitLabel = "rows",
  className = "",
  "aria-label": ariaLabel = "Document position",
}: {
  /** the full content — size it so it renders at exactly contentWidth x contentHeight */
  children: ReactNode;
  /** logical content extent in px that `children` occupies */
  contentWidth: number;
  contentHeight: number;
  /** minimap panel size in px — independent of content aspect ratio, like a scrollbar rail */
  minimapWidth?: number;
  minimapHeight?: number;
  /** fixed viewport pane height in px */
  viewportHeight?: number;
  /** row height in px — used only to phrase the aria-valuetext readout */
  rowHeight?: number;
  unitLabel?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const groupRef = useRef<SVGGElement | null>(null);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const circleRefs = useRef<(SVGCircleElement | null)[]>([]);

  const totalRows = Math.max(1, Math.round(contentHeight / rowHeight));
  const initialEndRow = Math.min(totalRows, Math.ceil(viewportHeight / rowHeight));

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    const handle = handleRef.current;
    const viewport = viewportRef.current;
    const group = groupRef.current;
    if (!container || !track || !handle || !viewport || !group) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scaleX = minimapWidth / contentWidth;
    const scaleY = minimapHeight / contentHeight;

    let vpW = viewport.clientWidth;
    let vpH = viewport.clientHeight;

    let dragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragScrollLeft = 0;
    let dragScrollTop = 0;

    let upPos: Vec = { x: 0, y: 0 };
    let upVel: Vec = { x: 0, y: 0 };
    let downPos: Vec = { x: 0, y: 0 };
    let downVel: Vec = { x: 0, y: 0 };
    let primed = false;

    let raf = 0;
    let last = 0;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const maxTop = () => Math.max(0, contentHeight - vpH);
    const maxLeft = () => Math.max(0, contentWidth - vpW);

    const markActive = () => {
      group.style.opacity = "1";
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        group.style.opacity = "0.3";
      }, IDLE_MS);
    };

    // returns true once settled (always true immediately under reduced motion)
    const springTo = (pos: Vec, vel: Vec, target: Vec, dt: number) => {
      if (reduced) {
        pos.x = target.x;
        pos.y = target.y;
        vel.x = 0;
        vel.y = 0;
        return true;
      }
      vel.x += (SPRING_K * (target.x - pos.x) - SPRING_C * vel.x) * dt;
      vel.y += (SPRING_K * (target.y - pos.y) - SPRING_C * vel.y) * dt;
      pos.x += vel.x * dt;
      pos.y += vel.y * dt;
      const dErr = Math.hypot(target.x - pos.x, target.y - pos.y);
      const vErr = Math.hypot(vel.x, vel.y);
      return dErr < SETTLE_EPS && vErr < SETTLE_V_EPS;
    };

    const frame = (now: number) => {
      raf = 0;
      const dt = last ? clamp((now - last) / 1000, 0.001, 1 / 30) : 1 / 60;
      last = now;

      const scrollTop = clamp(viewport.scrollTop, 0, maxTop());
      const scrollLeft = clamp(viewport.scrollLeft, 0, maxLeft());

      const rectW = Math.min(minimapWidth, Math.max(4, vpW * scaleX));
      const rectH = Math.min(minimapHeight, Math.max(4, vpH * scaleY));
      const rectLeft = clamp(scrollLeft * scaleX, 0, Math.max(0, minimapWidth - rectW));
      const rectTop = clamp(scrollTop * scaleY, 0, Math.max(0, minimapHeight - rectH));

      handle.style.left = `${rectLeft}px`;
      handle.style.top = `${rectTop}px`;
      handle.style.width = `${rectW}px`;
      handle.style.height = `${rectH}px`;

      const trackBox = track.getBoundingClientRect();
      const containerBox = container.getBoundingClientRect();
      const viewportBox = viewport.getBoundingClientRect();
      const originX = trackBox.left - containerBox.left;
      const originY = trackBox.top - containerBox.top;

      // A: the rect's near corner (moves with the drag). B: the real
      // viewport's fixed corner. Neither is ever sprung — only the elbow
      // joints between them are, so the linkage always looks attached.
      const a: Vec = { x: originX + rectLeft + rectW, y: originY + rectTop };
      const b: Vec = { x: viewportBox.left - containerBox.left, y: viewportBox.top - containerBox.top };

      const target = twoBarElbow(a, b, BOW);
      if (!primed) {
        upPos = { ...target.up };
        downPos = { ...target.down };
        primed = true;
      }
      const settledUp = springTo(upPos, upVel, target.up, dt);
      const settledDown = springTo(downPos, downVel, target.down, dt);

      const segs = lineRefs.current;
      const write = (el: SVGLineElement | null | undefined, p1: Vec, p2: Vec) => {
        if (!el) return;
        el.setAttribute("x1", String(p1.x));
        el.setAttribute("y1", String(p1.y));
        el.setAttribute("x2", String(p2.x));
        el.setAttribute("y2", String(p2.y));
      };
      write(segs[0], a, upPos);
      write(segs[1], upPos, b);
      write(segs[2], a, downPos);
      write(segs[3], downPos, b);

      const pts = [a, upPos, downPos, b];
      circleRefs.current.forEach((c, i) => {
        const p = pts[i];
        if (c && p) {
          c.setAttribute("cx", String(p.x));
          c.setAttribute("cy", String(p.y));
        }
      });

      const startRow = Math.floor(scrollTop / rowHeight) + 1;
      const endRow = Math.min(totalRows, Math.ceil((scrollTop + vpH) / rowHeight));
      handle.setAttribute("aria-valuenow", String(startRow));
      handle.setAttribute(
        "aria-valuetext",
        `viewing ${unitLabel} ${startRow}-${endRow} of ${totalRows}`
      );

      const active = dragging || !settledUp || !settledDown;
      if (active) raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      markActive();
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      track.setPointerCapture(e.pointerId);
      handle.focus({ preventScroll: true });
      dragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragScrollLeft = viewport.scrollLeft;
      dragScrollTop = viewport.scrollTop;
      wake();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dxContent = (e.clientX - dragStartX) / scaleX;
      const dyContent = (e.clientY - dragStartY) / scaleY;
      viewport.scrollLeft = clamp(dragScrollLeft + dxContent, 0, maxLeft());
      viewport.scrollTop = clamp(dragScrollTop + dyContent, 0, maxTop());
      wake();
    };
    const endDrag = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      try {
        track.releasePointerCapture(e.pointerId);
      } catch {
        // synthetic pointerId during autoplay — nothing to release
      }
      wake();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      let handled = true;
      switch (e.key) {
        case "ArrowDown":
          viewport.scrollTop = clamp(viewport.scrollTop + rowHeight, 0, maxTop());
          break;
        case "ArrowUp":
          viewport.scrollTop = clamp(viewport.scrollTop - rowHeight, 0, maxTop());
          break;
        case "ArrowRight":
          viewport.scrollLeft = clamp(viewport.scrollLeft + STEP_X, 0, maxLeft());
          break;
        case "ArrowLeft":
          viewport.scrollLeft = clamp(viewport.scrollLeft - STEP_X, 0, maxLeft());
          break;
        case "PageDown":
          viewport.scrollTop = clamp(viewport.scrollTop + vpH * 0.9, 0, maxTop());
          break;
        case "PageUp":
          viewport.scrollTop = clamp(viewport.scrollTop - vpH * 0.9, 0, maxTop());
          break;
        case "Home":
          viewport.scrollTop = 0;
          break;
        case "End":
          viewport.scrollTop = maxTop();
          break;
        default:
          handled = false;
      }
      if (handled) {
        e.preventDefault();
        wake();
      }
    };

    const onScroll = () => wake();

    const ro = new ResizeObserver(() => {
      vpW = viewport.clientWidth;
      vpH = viewport.clientHeight;
      wake();
    });
    ro.observe(viewport);

    track.addEventListener("pointerdown", onPointerDown);
    track.addEventListener("pointermove", onPointerMove);
    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
    handle.addEventListener("keydown", onKeyDown);
    viewport.addEventListener("scroll", onScroll, { passive: true });

    wake();

    return () => {
      cancelAnimationFrame(raf);
      if (idleTimer) clearTimeout(idleTimer);
      ro.disconnect();
      track.removeEventListener("pointerdown", onPointerDown);
      track.removeEventListener("pointermove", onPointerMove);
      track.removeEventListener("pointerup", endDrag);
      track.removeEventListener("pointercancel", endDrag);
      handle.removeEventListener("keydown", onKeyDown);
      viewport.removeEventListener("scroll", onScroll);
    };
  }, [contentWidth, contentHeight, minimapWidth, minimapHeight, viewportHeight, rowHeight, unitLabel, totalRows]);

  return (
    <div ref={containerRef} className={`relative flex items-start gap-24 ${className}`}>
      <div
        ref={trackRef}
        data-scissor-track
        className="relative shrink-0 touch-none select-none overflow-hidden rounded-sm border border-border bg-background"
        style={{ width: minimapWidth, height: minimapHeight }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 origin-top-left opacity-70"
          style={{
            width: contentWidth,
            height: contentHeight,
            transform: `scale(${minimapWidth / contentWidth}, ${minimapHeight / contentHeight})`,
          }}
        >
          {children}
        </div>
        <div
          ref={handleRef}
          role="slider"
          tabIndex={0}
          aria-label={ariaLabel}
          aria-orientation="vertical"
          aria-valuemin={1}
          aria-valuemax={totalRows}
          aria-valuenow={1}
          aria-valuetext={`viewing ${unitLabel} 1-${initialEndRow} of ${totalRows}`}
          className="absolute cursor-grab rounded-[3px] border-2 border-foreground/60 bg-foreground/[0.06] outline-none transition-colors hover:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background active:cursor-grabbing"
        />
      </div>

      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        <g ref={groupRef} className="text-muted transition-opacity duration-300 ease-out" style={{ opacity: 1 }}>
          {[0, 1, 2, 3].map((i) => (
            <line
              key={i}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              stroke="currentColor"
              strokeWidth={1}
            />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <circle
              key={i}
              ref={(el) => {
                circleRefs.current[i] = el;
              }}
              r={3}
              fill="currentColor"
            />
          ))}
        </g>
      </svg>

      <div
        ref={viewportRef}
        className="relative min-w-0 flex-1 overflow-auto rounded-sm border border-border bg-background"
        style={{ height: viewportHeight }}
      >
        <div style={{ width: contentWidth, height: contentHeight }}>{children}</div>
      </div>
    </div>
  );
}
