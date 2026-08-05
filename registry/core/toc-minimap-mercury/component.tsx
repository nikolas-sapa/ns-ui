"use client";

import { useEffect, useId, useRef, useState } from "react";

type MinimapSection = { id: string; label: string };

const RAIL_W = 48;
const CX = RAIL_W / 2;
const PAD = 16;

/** Evenly spaced tick centers along a rail of height H. */
function tickPositions(n: number, H: number): number[] {
  if (n <= 1) return [H / 2];
  return Array.from({ length: n }, (_, i) => PAD + (i * (H - 2 * PAD)) / (n - 1));
}

/** Piecewise-linear map: document read-line position → rail y via section offsets. */
function mapTarget(read: number, tops: number[], ticks: number[]): number {
  const n = ticks.length;
  const first = ticks[0] ?? 0;
  const last = ticks[n - 1] ?? first;
  if (n <= 1 || read <= (tops[0] ?? 0)) return first;
  if (read >= (tops[n - 1] ?? 0)) return last;
  let i = 0;
  while (i < n - 2 && read >= (tops[i + 1] ?? Infinity)) i++;
  const a = tops[i] ?? 0;
  const b = tops[i + 1] ?? a + 1;
  const t = (read - a) / Math.max(1, b - a);
  return (ticks[i] ?? 0) + t * ((ticks[i + 1] ?? 0) - (ticks[i] ?? 0));
}

// Liquid-mercury TOC minimap: scroll progress is a gooey column that climbs a
// fixed rail, absorbing section ticks as it reaches them. Spring-integrated on
// a direct-DOM rAF loop — no React state on the hot path, loop sleeps when
// settled. Static 2px line + dots under prefers-reduced-motion.
export function MercuryMinimap({
  sections,
  selector = "section[id]",
  offset = 0.35,
  stiffness = 120,
  damping = 20,
  className = "",
}: {
  /** explicit section list; omitted → auto-discovered via `selector` (label from data-minimap-label or id) */
  sections?: MinimapSection[];
  /** querySelectorAll used when `sections` is omitted */
  selector?: string;
  /** read-line as a fraction of viewport height — a section is "reached" when its top passes this line */
  offset?: number;
  /** spring stiffness for the blob (px/s² per px of error) */
  stiffness?: number;
  /** spring damping (slightly under critical → settle wobble) */
  damping?: number;
  className?: string;
}) {
  const [items, setItems] = useState<MinimapSection[] | null>(null);
  const [H, setH] = useState(0);
  const [reduced, setReduced] = useState(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLElement | null>(null);
  const colRef = useRef<SVGRectElement | null>(null);
  const blobRef = useRef<SVGCircleElement | null>(null);
  const helperRef = useRef<SVGCircleElement | null>(null);
  const lineRef = useRef<SVGRectElement | null>(null);
  const tickRefs = useRef<(SVGCircleElement | null)[]>([]);
  const gooTickRefs = useRef<(SVGCircleElement | null)[]>([]);
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  // lets the label buttons drive the hover bulge without React state
  const hoverCtl = useRef<(i: number) => void>(() => {});

  const rawId = useId();
  const fid = `goo-${rawId.replace(/[^a-zA-Z0-9-]/g, "")}`;

  // discovery + sizing (rare, state is fine here)
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const discover = () =>
      sections ??
      Array.from(document.querySelectorAll<HTMLElement>(selector)).map((el) => ({
        id: el.id,
        label: el.dataset.minimapLabel ?? el.id.toUpperCase(),
      }));
    // guard against unstable `sections` identity (e.g. an inline array literal
    // passed by the consumer): only commit a new `items` reference when the
    // discovered content actually changed, otherwise the mercury-loop effect
    // below (keyed on `items`) would tear down and rebuild every render.
    setItems((prev) => {
      const next = discover();
      if (
        prev &&
        prev.length === next.length &&
        prev.every((p, i) => p.id === next[i]?.id && p.label === next[i]?.label)
      ) {
        return prev;
      }
      return next;
    });
    const measure = () => setH(Math.round(window.innerHeight * 0.6));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [sections, selector]);

  // mercury loop — direct setAttribute writes only, sleeps when settled
  useEffect(() => {
    if (!items || items.length === 0 || !H || reduced) return;
    const n = items.length;
    const ticks = tickPositions(n, H);
    const railTop = ticks[0] ?? PAD;
    const els = items.map((s) => document.getElementById(s.id));
    let tops = items.map(() => 0);
    let vh = window.innerHeight;
    const measure = () => {
      vh = window.innerHeight;
      tops = els.map((el) => (el ? el.getBoundingClientRect().top + window.scrollY : 0));
    };
    measure();

    let scroll = window.scrollY;
    let y = mapTarget(scroll + vh * offset, tops, ticks);
    let v = 0;
    let helperR = 0;
    let hover = -1;
    let active = -2;
    let raf = 0;
    let last = 0;

    const setActive = (idx: number) => {
      if (idx === active) return;
      active = idx;
      labelRefs.current.forEach((el, i) => {
        if (!el) return;
        el.classList.toggle("text-foreground", i === idx);
        el.classList.toggle("text-ns-muted", i !== idx);
      });
    };

    const frame = (now: number) => {
      const dt = Math.min(Math.max((now - last) / 1000, 0.001), 1 / 30);
      last = now;
      const target = mapTarget(scroll + vh * offset, tops, ticks);

      // semi-implicit Euler spring — underdamped, so the settle wobble is free
      v += (stiffness * (target - y) - damping * v) * dt;
      y += v * dt;

      // volume-preserving droplet stretch, oriented along travel. A small
      // constant bias keeps the blob a teardrop (not a plain circle) even at
      // rest, so the liquid-mercury mechanic reads in a still frame too.
      const sY = 1.06 + Math.min(Math.abs(v) * 0.004, 0.74);
      const sX = 1 / Math.sqrt(sY);
      const lead = Math.sign(v) * (sY - 1) * 4;
      blobRef.current?.setAttribute(
        "transform",
        `translate(${CX} ${y + lead}) scale(${sX} ${sY})`
      );
      colRef.current?.setAttribute("height", `${Math.max(0, y - railTop)}`);

      // absorption: crossing a tick pulls it into the goo group; the filter
      // renders the merge, scrolling back up snaps the neck and releases it
      let reach = 0;
      for (let i = 0; i < n; i++) {
        const inGoo = y >= (ticks[i] ?? 0) - 6;
        if (inGoo) reach = i;
        const goo = gooTickRefs.current[i];
        if (goo) goo.style.visibility = inGoo ? "visible" : "hidden";
        const outline = tickRefs.current[i];
        if (outline) outline.style.opacity = inGoo ? "0" : "1";
      }
      setActive(reach);

      // hover bulge: helper circle grows 0→5 at 60% of the way toward the tick
      const hTarget = hover >= 0 ? 5 : 0;
      helperR += (hTarget - helperR) * Math.min(1, dt * 16);
      const helper = helperRef.current;
      if (helper) {
        if (hover >= 0) {
          const ty = ticks[hover] ?? railTop;
          const colY = Math.min(Math.max(ty, railTop), y);
          helper.setAttribute("cy", `${colY + 0.6 * (ty - colY)}`);
        }
        helper.setAttribute("r", `${Math.max(0, helperR)}`);
      }

      const settled =
        Math.abs(v) < 2 && Math.abs(target - y) < 0.5 && Math.abs(hTarget - helperR) < 0.05;
      raf = settled ? 0 : requestAnimationFrame(frame);
    };
    const wake = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    const onScroll = () => {
      scroll = window.scrollY;
      wake();
    };
    const onResize = () => {
      measure();
      scroll = window.scrollY;
      wake();
    };
    const onMove = (e: PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const py = e.clientY - svg.getBoundingClientRect().top;
      let best = -1;
      let bd = 24;
      for (let i = 0; i < n; i++) {
        const d = Math.abs(py - (ticks[i] ?? 0));
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      if (best !== hover) {
        hover = best;
        wake();
      }
    };
    const onLeave = () => {
      hover = -1;
      wake();
    };
    hoverCtl.current = (i: number) => {
      hover = i;
      wake();
    };

    const wrap = wrapRef.current;
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    wrap?.addEventListener("pointermove", onMove);
    wrap?.addEventListener("pointerleave", onLeave);
    wake();
    return () => {
      cancelAnimationFrame(raf);
      hoverCtl.current = () => {};
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      wrap?.removeEventListener("pointermove", onMove);
      wrap?.removeEventListener("pointerleave", onLeave);
    };
  }, [items, H, reduced, offset, stiffness, damping]);

  // reduced motion: plain filled line + dots, instant states, no rAF
  useEffect(() => {
    if (!items || items.length === 0 || !H || !reduced) return;
    const n = items.length;
    const ticks = tickPositions(n, H);
    const railTop = ticks[0] ?? PAD;
    const els = items.map((s) => document.getElementById(s.id));
    let tops = items.map(() => 0);
    const measure = () => {
      tops = els.map((el) => (el ? el.getBoundingClientRect().top + window.scrollY : 0));
    };
    measure();

    const apply = () => {
      const t = mapTarget(window.scrollY + window.innerHeight * offset, tops, ticks);
      lineRef.current?.setAttribute("height", `${Math.max(0, t - railTop)}`);
      let reach = 0;
      for (let i = 0; i < n; i++) {
        const on = t >= (ticks[i] ?? 0) - 6;
        if (on) reach = i;
        const dot = dotRefs.current[i];
        if (dot) {
          dot.setAttribute("fill", on ? "var(--color-foreground, #ededed)" : "none");
          dot.setAttribute(
            "stroke",
            on ? "var(--color-foreground, #ededed)" : "var(--color-ns-muted, #8f8f8f)"
          );
        }
      }
      labelRefs.current.forEach((el, i) => {
        if (!el) return;
        el.classList.toggle("text-foreground", i === reach);
        el.classList.toggle("text-ns-muted", i !== reach);
      });
    };
    const onResize = () => {
      measure();
      apply();
    };
    apply();
    window.addEventListener("scroll", apply, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", apply);
      window.removeEventListener("resize", onResize);
    };
  }, [items, H, reduced, offset]);

  if (!items || items.length === 0 || !H) return null;

  const ticks = tickPositions(items.length, H);
  const railTop = ticks[0] ?? PAD;

  return (
    <nav
      ref={wrapRef}
      aria-label="Section minimap"
      className={`group fixed right-4 top-1/2 z-40 -translate-y-1/2 ${className}`}
    >
      {items.map((s, i) => (
        <button
          key={s.id}
          type="button"
          aria-label={`Jump to ${s.label}`}
          onClick={() =>
            document
              .getElementById(s.id)
              ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" })
          }
          onFocus={() => hoverCtl.current(i)}
          onBlur={() => hoverCtl.current(-1)}
          className="absolute right-0 flex h-8 -translate-y-1/2 cursor-pointer items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          style={{ top: ticks[i] ?? 0, paddingRight: RAIL_W }}
        >
          <span
            ref={(el) => {
              labelRefs.current[i] = el;
            }}
            className="-translate-x-2 whitespace-nowrap pr-2 font-mono text-xs text-ns-muted opacity-0 transition-[transform,opacity] duration-150 ease-out group-focus-within:translate-x-0 group-focus-within:opacity-100 group-hover:translate-x-0 group-hover:opacity-100 motion-reduce:transition-none"
          >
            {s.label}
          </span>
        </button>
      ))}

      {reduced ? (
        <svg width={RAIL_W} height={H} viewBox={`0 0 ${RAIL_W} ${H}`} aria-hidden className="block">
          <rect
            ref={lineRef}
            x={CX - 1}
            y={railTop}
            width={2}
            height={0}
            fill="var(--color-foreground, #ededed)"
          />
          {items.map((s, i) => (
            <circle
              key={s.id}
              ref={(el) => {
                dotRefs.current[i] = el;
              }}
              cx={CX}
              cy={ticks[i] ?? 0}
              r={4}
              fill="none"
              stroke="var(--color-ns-muted, #8f8f8f)"
              strokeWidth={1.5}
            />
          ))}
        </svg>
      ) : (
        <svg
          ref={svgRef}
          width={RAIL_W}
          height={H}
          viewBox={`0 0 ${RAIL_W} ${H}`}
          aria-hidden
          className="block overflow-visible"
        >
          <defs>
            <filter
              id={fid}
              x="-100%"
              y="-20%"
              width="300%"
              height="140%"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              />
            </filter>
          </defs>
          {/* outline ticks — outside the goo so they stay crisp until absorbed */}
          {items.map((s, i) => (
            <circle
              key={s.id}
              ref={(el) => {
                tickRefs.current[i] = el;
              }}
              cx={CX}
              cy={ticks[i] ?? 0}
              r={4}
              fill="none"
              stroke="var(--color-ns-muted, #8f8f8f)"
              strokeWidth={1.5}
              style={{ transition: "opacity 150ms ease-out" }}
            />
          ))}
          {/* liquid layer — everything in here gooey-merges */}
          <g filter={`url(#${fid})`} fill="var(--color-foreground, #ededed)">
            {/* 8px wide: survives the blur-4 → ×19−9 alpha threshold (4px would vanish) */}
            <rect ref={colRef} x={CX - 4} y={railTop} width={8} height={0} rx={4} />
            {items.map((s, i) => (
              <circle
                key={s.id}
                ref={(el) => {
                  gooTickRefs.current[i] = el;
                }}
                cx={CX}
                cy={ticks[i] ?? 0}
                r={6}
                style={{ visibility: "hidden" }}
              />
            ))}
            <circle ref={helperRef} cx={CX} cy={railTop} r={0} />
            <circle ref={blobRef} r={7} transform={`translate(${CX} ${railTop})`} />
          </g>
        </svg>
      )}
    </nav>
  );
}
