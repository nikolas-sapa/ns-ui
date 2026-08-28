"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// AirliftSlugFlow — a background file-sync/upload activity rail: a slim
// vertical conduit, sized off the container's smaller dimension, standing in
// for a generic spinner or a looping "syncing…" label. The mechanic is a
// real airlift pump (mining dewatering, geothermal lift, aquarium airlift):
// compressed air injected at the foot of a submerged riser forms discrete gas
// slugs, and each slug's buoyant rise drags the plug of liquid immediately
// ahead of it up the pipe — classic two-phase "slug flow", delivery arriving
// in distinct pulses rather than a continuous stream.
//
// A new slug/plug pair is injected at the rail's foot every 1.8s (inside the
// real 0.5-3Hz small-riser slugging band) and rises at a constant 140px/s
// (buoyancy-driven rise is near-constant, not accelerating). The slug is a
// rounded capsule at reduced --foreground opacity (the bubble read); the
// liquid plug it drags is a solid --foreground band riding flush against the
// slug's leading edge, same speed — two coupled parts, never one blob. On
// reaching the rail's head the pair fades over 220ms and deposits into a
// small accumulator basin, whose fill increments 1/14th per arrival and
// wraps every 14 arrivals (~25s self-contained macro-cycle).
//
// Everything is driven off a virtual clock that only advances while the rail
// is on-screen (an IntersectionObserver pauses/resumes it), so a tab-away
// never produces a catch-up burst on return. Geometry is recomputed from a
// ResizeObserver reading the container's own box — no restart on resize, the
// running pairs simply reflow onto the new rail height next frame.
// ---------------------------------------------------------------------------

const INJECT_INTERVAL_MS = 1800; // slug injection period — real 0.5-3Hz small-riser band
const RISE_SPEED_PX_S = 140; // constant buoyancy-driven rise speed
const SLUG_HEIGHT_FRAC = 0.09; // slug capsule height, fraction of rail height
const PLUG_HEIGHT_FRAC = 0.14; // dragged liquid plug height, fraction of rail height
const FADE_MS = 220; // arrival fade-out, slug+plug together
const BASIN_STEPS = 14; // arrivals per full basin cycle (~25s macro-cycle)
const RAIL_WIDTH_FRAC = 0.08; // rail width = 8% of the container's smaller dimension
const RAIL_WIDTH_MIN = 5;
const RAIL_WIDTH_MAX = 22;
const BASIN_SIZE_MULT = 2.4; // basin side length = rail width * this
const BASIN_GAP = 3; // px gap between rail head and basin
const REDUCED_BASIN_FRAC = 5 / BASIN_STEPS; // frozen-frame basin level — mid-cycle, not 0 or full

interface Pair {
  slug: HTMLDivElement;
  plug: HTMLDivElement;
  injectedAtV: number; // virtual ms timestamp at injection
  fading: boolean;
  fadeStartV: number;
}

export interface AirliftSlugFlowProps {
  /** fired once per slug arrival at the basin — hook a real file row's status pulse to it */
  onSlugArrival?: () => void;
  /** extra classes merged onto the root element */
  className?: string;
}

export function AirliftSlugFlow({ onSlugArrival, className = "" }: AirliftSlugFlowProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const basinRef = useRef<HTMLDivElement>(null);
  const basinFillRef = useRef<HTMLDivElement>(null);
  const onArrivalRef = useRef(onSlugArrival);
  onArrivalRef.current = onSlugArrival;

  useEffect(() => {
    const root = rootRef.current;
    const rail = railRef.current;
    const column = columnRef.current;
    const layer = layerRef.current;
    const basin = basinRef.current;
    const basinFill = basinFillRef.current;
    if (!root || !rail || !column || !layer || !basin || !basinFill) return;

    let disposed = false;
    let railWidthPx = 0;
    let railHeightPx = 0;
    let visible = true;
    let raf = 0;
    let last = 0;
    let vClock = 0;
    let injectAcc = 0;
    let arrivalCount = 0;
    let pairs: Pair[] = [];

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");

    const layoutBasin = () => {
      const size = Math.min(RAIL_WIDTH_MAX * BASIN_SIZE_MULT, Math.max(RAIL_WIDTH_MIN * BASIN_SIZE_MULT, railWidthPx * BASIN_SIZE_MULT));
      basin.style.width = `${size}px`;
      basin.style.height = `${size}px`;
      basin.style.marginBottom = `${BASIN_GAP}px`;
    };

    const setBasinFrac = (frac: number) => {
      basinFill.style.height = `${Math.max(0, Math.min(1, frac)) * 100}%`;
    };

    const spawnPair = (injectedAtV: number) => {
      const slug = document.createElement("div");
      slug.className = "asf-slug";
      const plug = document.createElement("div");
      plug.className = "asf-plug";
      layer.appendChild(plug);
      layer.appendChild(slug);
      pairs.push({ slug, plug, injectedAtV, fading: false, fadeStartV: 0 });
    };

    const removePair = (p: Pair) => {
      p.slug.remove();
      p.plug.remove();
    };

    const arrive = () => {
      arrivalCount = (arrivalCount % BASIN_STEPS) + 1;
      setBasinFrac(arrivalCount / BASIN_STEPS);
      onArrivalRef.current?.();
    };

    const applyPairStyle = (p: Pair, elapsedV: number) => {
      const slugH = railHeightPx * SLUG_HEIGHT_FRAC;
      const plugH = railHeightPx * PLUG_HEIGHT_FRAC;
      const y = (elapsedV / 1000) * RISE_SPEED_PX_S;
      const slugTop = y + slugH;
      const pairTop = slugTop + plugH;

      if (!p.fading && pairTop >= railHeightPx) {
        p.fading = true;
        p.fadeStartV = elapsedV;
        p.slug.style.transition = `opacity ${FADE_MS}ms linear`;
        p.plug.style.transition = `opacity ${FADE_MS}ms linear`;
        p.slug.style.opacity = "0";
        p.plug.style.opacity = "0";
        arrive();
      }

      p.slug.style.height = `${slugH}px`;
      p.slug.style.bottom = `${Math.min(y, railHeightPx - slugH)}px`;
      p.plug.style.height = `${plugH}px`;
      p.plug.style.bottom = `${Math.min(slugTop, railHeightPx - 0)}px`;
    };

    const layoutFrozenFrame = () => {
      const slugH = railHeightPx * SLUG_HEIGHT_FRAC;
      const plugH = railHeightPx * PLUG_HEIGHT_FRAC;
      const pairH = slugH + plugH;
      const bottom = railHeightPx * 0.5 - pairH / 2;
      layer.innerHTML = "";
      const slug = document.createElement("div");
      slug.className = "asf-slug";
      slug.style.height = `${slugH}px`;
      slug.style.bottom = `${bottom}px`;
      const plug = document.createElement("div");
      plug.className = "asf-plug";
      plug.style.height = `${plugH}px`;
      plug.style.bottom = `${bottom + slugH}px`;
      layer.appendChild(plug);
      layer.appendChild(slug);
      setBasinFrac(REDUCED_BASIN_FRAC);
    };

    const measure = () => {
      const rect = root.getBoundingClientRect();
      const minDim = Math.min(rect.width, rect.height);
      railWidthPx = Math.max(RAIL_WIDTH_MIN, Math.min(RAIL_WIDTH_MAX, minDim * RAIL_WIDTH_FRAC));
      column.style.width = `${railWidthPx}px`;
      rail.style.width = `${railWidthPx}px`;
      layoutBasin();
      const basinRect = basin.getBoundingClientRect();
      railHeightPx = Math.max(0, rect.height - basinRect.height - BASIN_GAP);
      rail.style.height = `${railHeightPx}px`;
      if (mq.matches) layoutFrozenFrame();
    };

    const loop = (now: number) => {
      raf = 0;
      if (disposed) return;
      if (!visible || railHeightPx <= 0) {
        raf = requestAnimationFrame(loop);
        return;
      }
      if (last === 0) last = now;
      const dt = Math.min(100, now - last);
      last = now;
      vClock += dt;

      injectAcc += dt;
      while (injectAcc >= INJECT_INTERVAL_MS) {
        injectAcc -= INJECT_INTERVAL_MS;
        spawnPair(vClock);
      }

      pairs = pairs.filter((p) => {
        const elapsedV = vClock - p.injectedAtV;
        applyPairStyle(p, elapsedV);
        if (p.fading && vClock - p.fadeStartV >= FADE_MS) {
          removePair(p);
          return false;
        }
        return true;
      });

      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      measure();
      if (mq.matches) return; // reduced motion: one static frame, no loop
      last = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const onReducedChange = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      layer.innerHTML = "";
      pairs = [];
      injectAcc = 0;
      vClock = 0;
      last = 0;
      arrivalCount = 0;
      setBasinFrac(0);
      start();
    };
    mq.addEventListener("change", onReducedChange);

    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (disposed) return;
        measure();
      }, 100);
    });
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !mq.matches && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(root);

    document.fonts.ready.then(() => {
      if (!disposed) measure();
    });

    start();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      window.clearTimeout(resizeTimer);
      mq.removeEventListener("change", onReducedChange);
      ro.disconnect();
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={rootRef} className={`relative flex h-full w-full flex-col items-center justify-end ${className}`}>
      <style>{CSS}</style>
      <div ref={basinRef} className="asf-basin">
        <div ref={basinFillRef} className="asf-basin-fill" />
      </div>
      <div ref={columnRef} className="relative">
        <div ref={railRef} className="asf-static-column relative overflow-visible">
          <div ref={layerRef} className="absolute inset-x-0 bottom-0" />
        </div>
      </div>
    </div>
  );
}

const CSS = `
.asf-static-column {
  background: var(--ns-muted);
  opacity: 0.3;
  border-radius: 999px;
}
.dark .asf-static-column {
  opacity: 0.16;
}
.asf-slug {
  position: absolute;
  left: 0;
  right: 0;
  border-radius: 999px;
  background: var(--foreground);
  opacity: 0.4;
}
.asf-plug {
  position: absolute;
  left: 0;
  right: 0;
  border-radius: 2px;
  background: var(--foreground);
  opacity: 1;
}
.asf-basin {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--background);
}
.asf-basin-fill {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 0%;
  background: var(--foreground);
  transition: height 220ms linear;
}
`;
