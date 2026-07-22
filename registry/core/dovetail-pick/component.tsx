"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// DovetailPick — segmented control / radio group whose selection indicator is
// a subtly tapered SVG trapezoid: joinery, not highlighting. Selecting a new
// option lifts the trapezoid out of its old slot (instant, no transition),
// then eases it across to the new slot on the next frame while sliding its
// width/position and settling 1px deeper to "seat" on arrival (transform +
// width + top, all on one ease-out-expo curve, ~260ms). The previously
// selected label's bold/nudge treatment releases 40ms *before* the newly
// selected label's lands — the old joint visibly opens before the new one
// closes, which is the whole tell. Options are flush with hairline dividers
// (divide-x) standing in for the plank's slot walls; the trapezoid is inset
// a few px inside its slot so a sliver of wall shows at rest, keeping the
// "fitted piece" read legible even in a single static frame. Real
// role=radiogroup of role=radio buttons with roving tabindex — Arrow/Home/End
// move selection and each move replays the slide-and-seat; aria-checked
// flips the instant a selection commits, independent of the cosmetic seat
// lag, so assistive tech is never behind the animation. prefers-reduced-
// motion: the trapezoid still jumps straight to its 1px-seated resting
// pose (sub-threshold, non-vestibular) with no slide and no release lag —
// the fitted look survives, the motion doesn't. Every ink is a token
// (--background/--foreground/--border/--muted, --accent only as the focus
// ring) — no canvas, no gradients, no drag: click and keyboard only.
// ---------------------------------------------------------------------------

const DURATION = 260; // ease-out-expo slide+seat, ms
const RELEASE_LEAD = 40; // old joint opens this many ms before the new one seats
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)"; // ease-out-expo approximation
const SEAT_Y = 1; // px — how deep the trapezoid drops to "seat"
const MARGIN_X = 3; // px inset so slot walls stay visible at rest
const MARGIN_Y = 3;

export interface DovetailPickOption {
  value: string;
  label: string;
}

const DEFAULT_OPTIONS: DovetailPickOption[] = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
  { value: "spacious", label: "Spacious" },
];

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function DovetailPick({
  options = DEFAULT_OPTIONS,
  value,
  defaultValue,
  onValueChange,
  className = "",
  "aria-label": ariaLabel = "Options",
}: {
  options?: DovetailPickOption[];
  /** controlled value; omit for uncontrolled */
  value?: string;
  defaultValue?: string;
  /** fires once per selection change, on commit */
  onValueChange?: (value: string) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rectsRef = useRef<Rect[]>([]);
  const prevIndexRef = useRef(-1);
  const reducedRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const travelingRef = useRef(false);

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(
    defaultValue ?? options[0]?.value ?? ""
  );
  const selectedValue = isControlled ? value : internal;
  let selectedIndex = options.findIndex((o) => o.value === selectedValue);
  if (selectedIndex < 0) selectedIndex = 0;

  // which label currently wears the seated (bold + 1px nudge) treatment —
  // lags the real selection by the choreography below; -1 = nobody seated
  // (the brief gap between the old joint opening and the new one closing)
  const [seatedIndex, setSeatedIndex] = useState(selectedIndex);

  const setIndex = (i: number) => {
    const opt = options[i];
    if (!opt) return;
    if (!isControlled) setInternal(opt.value);
    if (opt.value !== selectedValue) onValueChange?.(opt.value);
  };

  const optKey = options.map((o) => o.value).join(" ");

  const place = (r: Rect, seated: boolean, animate: boolean) => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.style.transition = animate
      ? [
          `transform ${DURATION}ms ${EASE}`,
          `width ${DURATION}ms ${EASE}`,
          `height ${DURATION}ms ${EASE}`,
          `top ${DURATION}ms ${EASE}`,
        ].join(", ")
      : "none";
    svg.style.width = `${Math.max(0, r.width - MARGIN_X * 2)}px`;
    svg.style.height = `${Math.max(0, r.height - MARGIN_Y * 2)}px`;
    svg.style.top = `${r.top + MARGIN_Y}px`;
    svg.style.transform = `translate(${r.left + MARGIN_X}px, ${
      seated ? SEAT_Y : 0
    }px)`;
  };

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  // measure every slot's box; re-snap the (idle) indicator on resize
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onMqChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onMqChange);

    const measure = () => {
      rectsRef.current = btnRefs.current.slice(0, options.length).map((b) => ({
        left: b?.offsetLeft ?? 0,
        top: b?.offsetTop ?? 0,
        width: b?.offsetWidth ?? 0,
        height: b?.offsetHeight ?? 0,
      }));
      if (!travelingRef.current) {
        const r = rectsRef.current[selectedIndex];
        if (r && r.width > 0) place(r, seatedIndex === selectedIndex, false);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", onMqChange);
    };
    // re-measure when the option set changes shape; selection/seat handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optKey]);

  // the slide-and-seat choreography — runs on every selection change
  useEffect(() => {
    const prev = prevIndexRef.current;
    prevIndexRef.current = selectedIndex;
    const rects = rectsRef.current;
    const newR = rects[selectedIndex];
    if (!newR || newR.width === 0) return;

    if (prev === -1 || prev === selectedIndex) {
      // first paint (or no real change) — land seated, no travel
      place(newR, true, false);
      setSeatedIndex(selectedIndex);
      return;
    }

    clearTimers();
    const oldR = rects[prev] ?? newR;

    if (reducedRef.current) {
      // instant jump, but the 1px seat survives — sub-threshold, non-vestibular
      place(newR, true, false);
      setSeatedIndex(selectedIndex);
      return;
    }

    travelingRef.current = true;
    place(oldR, false, false); // lift: unseat instantly, still at the old slot
    void svgRef.current?.getBoundingClientRect(); // flush before the next write
    requestAnimationFrame(() => {
      place(newR, true, true); // slide across, easing down into the new seat
    });

    timersRef.current = [
      window.setTimeout(() => setSeatedIndex(-1), DURATION - RELEASE_LEAD),
      window.setTimeout(() => {
        setSeatedIndex(selectedIndex);
        travelingRef.current = false;
      }, DURATION),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  useEffect(() => clearTimers, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const n = options.length;
    if (n === 0) return;
    let next = -1;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (selectedIndex + 1) % n;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (selectedIndex - 1 + n) % n;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = n - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    setIndex(next);
    btnRefs.current[next]?.focus();
  };

  return (
    <div
      ref={trackRef}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={`relative inline-flex select-none divide-x divide-border overflow-hidden rounded-md border border-border bg-foreground/[0.04] ${className}`}
    >
      <svg
        ref={svgRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 will-change-transform"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polygon
          points="15,12 85,12 95,88 5,88"
          fill="var(--background)"
          stroke="var(--foreground)"
          strokeOpacity={0.5}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {options.map((opt, i) => {
        const checked = i === selectedIndex;
        const seated = i === seatedIndex;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              btnRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => setIndex(i)}
            className={`relative z-10 px-4 py-2 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
              checked ? "text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            <span
              className="inline-block transition-transform duration-150 ease-out"
              style={{
                transform: seated ? "translateY(1px)" : "translateY(0)",
                fontWeight: seated ? 600 : 400,
                transitionProperty: "transform, font-weight",
              }}
            >
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
