"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// GantryRun — a scroll-scrubbed, infinitely-looping 3D card gallery. Cards
// hang off a receding gantry track: real CSS `perspective` + `preserve-3d`
// does the projection (translate3d/rotateY per card, written directly to
// each card's ref every frame — no React state on the hot path), the browser
// computes the actual on-screen scale and foreshortening.
//
// The loop is a buffer trick: the item list is rendered twice back to back
// along the track, and scroll progress drives a camera distance that runs
// exactly the length of ONE set before the pass completes — so by the time
// the last real card has receded out of view, its duplicate is already
// approaching from the far end, and the whole thing reads as an unbroken
// belt. There is no distance-to-mouse magnetism per card (that always reads
// as N springs firing independently as the pointer crosses the grid) —
// instead the track itself tilts toward the pointer like a specimen tray,
// and whichever card currently sits nearest the camera (by depth, not by
// pointer distance) gets a procedural focus highlight and its title is
// pushed into a live readout — the "camera" itself is what has attention,
// not the mouse.
// ---------------------------------------------------------------------------

export interface GantryItem {
  id: string;
  title: string;
  caption?: string;
}

export interface GantryRunProps {
  /** the gallery images, in order */
  items?: GantryItem[];
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const DEFAULT_ITEMS: GantryItem[] = [
  { id: "01", title: "Signal Plate", caption: "Rev. A" },
  { id: "02", title: "Trace Coil", caption: "Rev. C" },
  { id: "03", title: "Bench Jig", caption: "Rev. B" },
  { id: "04", title: "Vernier Set", caption: "Rev. A" },
  { id: "05", title: "Ratchet Frame", caption: "Rev. D" },
  { id: "06", title: "Sounding Rail", caption: "Rev. B" },
  { id: "07", title: "Gantry Head", caption: "Rev. A" },
  { id: "08", title: "Solder Bridge", caption: "Rev. C" },
];

const STEP_X = 34; // px lateral drift per card
const STEP_Y = -16; // px vertical rise per card
const STEP_Z = 260; // px receding depth per card
const FOCUS_WINDOW = 130; // depth window (px) counted as "in focus"

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function GantryRun({ items = DEFAULT_ITEMS, className = "" }: GantryRunProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelRef = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const doubled = [...items, ...items];
  const loopDistance = items.length * STEP_Z;

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;

    let raf = 0;
    let p = 0; // scroll progress 0..1
    let tiltX = 0;
    let tiltY = 0;
    let tiltTargetX = 0;
    let tiltTargetY = 0;
    let focusIndex = -1;
    let dirty = true;

    const frame = () => {
      dirty = false;
      const camZ = p * loopDistance;

      const k = 0.1;
      tiltX += (tiltTargetX - tiltX) * k;
      tiltY += (tiltTargetY - tiltY) * k;
      track.style.transform = `rotateX(${tiltY.toFixed(3)}deg) rotateY(${tiltX.toFixed(3)}deg)`;

      let bestDz = Infinity;
      let bestIdx = -1;
      for (let i = 0; i < doubled.length; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;
        const worldZ = i * STEP_Z;
        const dz = worldZ - camZ;
        const adz = Math.abs(dz);
        if (adz < bestDz) {
          bestDz = adz;
          bestIdx = i;
        }
        // cull cards far behind the camera or far down the track
        if (dz < -STEP_Z * 1.5 || dz > loopDistance + STEP_Z * 1.5) {
          el.style.opacity = "0";
          continue;
        }
        const worldX = i * STEP_X;
        const worldY = i * STEP_Y;
        const inFocus = adz < FOCUS_WINDOW;
        const scale = inFocus ? 1.05 : 1;
        el.style.transform = `translate3d(${worldX}px, ${worldY}px, ${(-dz).toFixed(1)}px) rotateY(-6deg) scale(${scale})`;
        const fade = Math.max(0, 1 - Math.max(0, dz + STEP_Z) / (loopDistance * 0.55));
        el.style.opacity = String(Math.min(1, Math.max(0, fade)));
        el.dataset.focused = inFocus ? "true" : "false";
      }

      if (bestIdx !== focusIndex && bestIdx >= 0) {
        focusIndex = bestIdx;
        const item = items[bestIdx % items.length];
        if (labelRef.current && item) {
          labelRef.current.textContent = `${item.id} — ${item.title}`;
        }
      }

      const tiltSettled = Math.abs(tiltTargetX - tiltX) < 0.02 && Math.abs(tiltTargetY - tiltY) < 0.02;
      if (!dirty && tiltSettled) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const readScroll = () => {
      const rect = section.getBoundingClientRect();
      const trackLen = rect.height - window.innerHeight;
      p = trackLen > 0 ? Math.min(1, Math.max(0, -rect.top / trackLen)) : 0;
      dirty = true;
      wake();
    };

    const onPointer = (e: PointerEvent) => {
      const rect = section.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = Math.min(window.innerHeight, rect.height);
      tiltTargetX = ((e.clientX - vw / 2) / vw) * 14;
      tiltTargetY = -((e.clientY - vh / 2) / vh) * 8;
      dirty = true;
      wake();
    };
    const onLeave = () => {
      tiltTargetX = 0;
      tiltTargetY = 0;
      dirty = true;
      wake();
    };

    readScroll();
    wake();
    window.addEventListener("scroll", readScroll, { passive: true });
    window.addEventListener("resize", readScroll);
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", readScroll);
      window.removeEventListener("resize", readScroll);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerleave", onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, loopDistance, reduced]);

  // prefers-reduced-motion: no scroll scrub, no 3D tilt, no receding track —
  // a plain static grid of the same cards, same tokens, same focus styling
  // rules minus the depth-driven trigger.
  if (reduced) {
    return (
      <section data-gallery-gantry-track data-gantry-viewport className={`bg-background px-6 py-16 ${className}`}>
        <div className="mx-auto flex max-w-4xl items-center justify-between pb-6">
          <span className="font-mono text-xs uppercase tracking-widest text-ns-muted">Gantry catalog</span>
          <span className="font-mono text-xs tabular-nums text-foreground">{items.length} items</span>
        </div>
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.id}
              data-gantry-card
              className="flex h-[220px] flex-col justify-between rounded-[12px] border border-border bg-surface p-4 shadow-sm"
            >
              <span className="font-mono text-[10px] uppercase tracking-widest text-ns-muted">{item.id}</span>
              <div
                aria-hidden
                className="h-16 w-full rounded-sm border border-border"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(135deg, var(--border) 0px, var(--border) 1px, transparent 1px, transparent 9px)",
                }}
              />
              <div>
                <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                {item.caption ? <p className="truncate text-xs text-ns-muted">{item.caption}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} data-gallery-gantry-track className={`relative h-[400vh] bg-background ${className}`}>
      <div data-gantry-viewport className="sticky top-0 flex h-screen w-full flex-col overflow-hidden">

        <div
          data-gantry-stage
          className="flex flex-1 items-center justify-center"
          style={{ perspective: "1400px", perspectiveOrigin: "50% 45%" }}
        >
          <div ref={trackRef} className="relative h-0 w-0" style={{ transformStyle: "preserve-3d" }}>
            {doubled.map((item, i) => (
              <div
                key={`${item.id}-${i}`}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                data-gantry-card
                className="absolute flex h-[220px] w-[168px] -translate-x-1/2 -translate-y-1/2 flex-col justify-between rounded-[12px] border bg-surface p-4 shadow-sm transition-[border-color,box-shadow] duration-200 ease-out data-[focused=true]:border-ns-accent data-[focused=true]:shadow-md"
                style={{ borderColor: "var(--border)", transformStyle: "preserve-3d" }}
              >
                <span className="font-mono text-[10px] uppercase tracking-widest text-ns-muted">{item.id}</span>
                <div
                  aria-hidden
                  className="h-16 w-full rounded-sm border border-border"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(135deg, var(--border) 0px, var(--border) 1px, transparent 1px, transparent 9px)",
                  }}
                />
                <div>
                  <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                  {item.caption ? <p className="truncate text-xs text-ns-muted">{item.caption}</p> : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-1.5">
          <span ref={labelRef} className="font-mono text-xs tabular-nums text-foreground">
            {items[0] ? `${items[0].id} — ${items[0].title}` : ""}
          </span>
          <p className="text-center font-mono text-[11px] tracking-widest text-ns-muted">SCROLL TO RUN THE GANTRY</p>
        </div>
      </div>
    </section>
  );
}
