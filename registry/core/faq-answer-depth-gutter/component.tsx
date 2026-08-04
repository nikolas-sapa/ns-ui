"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type TransitionEvent as ReactTransitionEvent,
} from "react";

// ---------------------------------------------------------------------------
// FaqDepthGutter — an FAQ whose left gutter is a real measurement instrument.
//
// One offscreen mirror (left:-9999px, visibility:hidden, aria-hidden) is held
// at exactly the answer column's measured width; every answer is rendered into
// it and its offsetHeight recorded into a Map<id, naturalHeight>. A
// ResizeObserver on a zero-height probe row in the answer column re-measures
// the whole map only when the column's width moves by more than 2px, so this
// never runs per frame.
//
// That one cached number drives everything:
//   at rest   the item's tick is clamp(6, natural * 0.22, 64) px of --border
//             ink — a scaled-down but truthful preview, so the column reads
//             as a bar chart of answer length with no interaction at all;
//   on hover  the tick eases to min(natural, 260) px of --accent at 55% over
//             220ms cubic-bezier(0.22,1,0.36,1) — the page has not moved yet,
//             but you can see how far it is about to;
//   on open   the SAME number animates the panel 0 -> natural over 260ms
//             (then pinned to height:auto on transitionend, so later reflow
//             or a text-wrap change stays correct) while the tick locks at
//             exactly natural in solid --accent.
// The promise and the delivery are literally the same measurement.
//
// Closing reverses: height:auto is pinned back to the measured px, forced
// reflow, then eased to 0 over 200ms; `hidden` goes on only after that
// transition ends, so a screen reader never sees a half-collapsed region.
// With allowMultiple=false the outgoing close and the incoming open are
// scheduled on the SAME rAF frame, so the net page displacement is one
// continuous movement rather than two competing transitions.
//
// Real button semantics (Tab/Enter/Space are native — no keydown handler),
// aria-expanded on the trigger, aria-controls -> a role=region panel labelled
// by the trigger, data-open exposed for probing. prefers-reduced-motion drops
// the hover preview entirely (the tick stays at its resting height) and the
// panel toggles between 0 and auto with no transition. Tokens only; --accent
// appears on the tick, the focus ring and the hovered question, nowhere else.
// Zero dependencies.
// ---------------------------------------------------------------------------

const REST_RATIO = 0.22;
const REST_MIN = 6;
const REST_MAX = 64;
const PREVIEW_MAX = 260;
const OPEN_MS = 260;
const CLOSE_MS = 200;
const EASE = "cubic-bezier(0.22,1,0.36,1)";
const WIDTH_EPSILON = 2;

export interface FaqDepthItem {
  id: string;
  question: string;
  answer: ReactNode;
}

export interface FaqDepthGutterProps {
  items: FaqDepthItem[];
  /** Allow more than one answer open at once. Default false (single-open). */
  allowMultiple?: boolean;
  /** Item ids open on first render. */
  defaultOpen?: string[];
  className?: string;
}

function clamp(min: number, value: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

export function FaqDepthGutter({
  items,
  allowMultiple = false,
  defaultOpen = [],
  className = "",
}: FaqDepthGutterProps) {
  const baseId = useId().replace(/:/g, "");
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(defaultOpen));
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [reduced, setReduced] = useState(false);

  const mirrorRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const initialized = useRef<Set<string>>(new Set());
  const heightsRef = useRef<Record<string, number>>({});
  const lastWidth = useRef(0);
  const prevOpen = useRef<Set<string>>(new Set(defaultOpen));
  const openRef = useRef(openIds);
  const rafRef = useRef<number | null>(null);
  const reducedRef = useRef(false);

  openRef.current = openIds;

  // --- reduced motion -----------------------------------------------------
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      reducedRef.current = mq.matches;
      setReduced(mq.matches);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // --- measurement --------------------------------------------------------
  const measure = useCallback(() => {
    const mirror = mirrorRef.current;
    const probe = probeRef.current;
    if (!mirror || !probe) return;
    const width = probe.clientWidth;
    if (width <= 0) return;
    mirror.style.width = `${width}px`;
    const next: Record<string, number> = {};
    mirror.querySelectorAll<HTMLElement>("[data-mirror-id]").forEach((el) => {
      const id = el.dataset.mirrorId;
      if (id) next[id] = el.offsetHeight;
    });
    heightsRef.current = next;
    setHeights(next);
  }, []);

  useLayoutEffect(() => {
    const probe = probeRef.current;
    if (!probe) return;
    lastWidth.current = probe.clientWidth;
    measure();
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (Math.abs(width - lastWidth.current) <= WIDTH_EPSILON) return;
      lastWidth.current = width;
      measure();
    });
    ro.observe(probe);
    // Web fonts land after first layout and change every answer's height, so
    // re-measure once they're ready or the bars are drawn from fallback metrics.
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) measure();
    });
    return () => {
      alive = false;
      ro.disconnect();
    };
  }, [measure, items]);

  // --- open / close choreography -----------------------------------------
  const expand = useCallback((id: string) => {
    const el = panelRefs.current.get(id);
    if (!el) return;
    // `||` not `??`: a measured 0 (container laid out at zero width) must fall
    // back to scrollHeight, or the 0 -> 0 transition never fires transitionend
    // and the panel stays stuck shut with aria-expanded=true.
    const natural = heightsRef.current[id] || el.scrollHeight;
    el.hidden = false;
    el.style.transition = "none";
    el.style.height = "0px";
    void el.offsetHeight; // forced reflow: commit the start height
    if (reducedRef.current) {
      el.style.transition = "";
      el.style.height = "auto";
      return;
    }
    el.style.transition = `height ${OPEN_MS}ms ${EASE}`;
    el.style.height = `${natural}px`;
  }, []);

  const collapse = useCallback((id: string) => {
    const el = panelRefs.current.get(id);
    if (!el) return;
    el.style.transition = "none";
    el.style.height = `${el.offsetHeight}px`; // pin height:auto back to px
    void el.offsetHeight; // forced reflow before easing down
    if (reducedRef.current) {
      el.style.transition = "";
      el.style.height = "0px";
      el.hidden = true;
      return;
    }
    el.style.transition = `height ${CLOSE_MS}ms ${EASE}`;
    el.style.height = "0px";
  }, []);

  useEffect(() => {
    const opening: string[] = [];
    const closing: string[] = [];
    openIds.forEach((id) => {
      if (!prevOpen.current.has(id)) opening.push(id);
    });
    prevOpen.current.forEach((id) => {
      if (!openIds.has(id)) closing.push(id);
    });
    prevOpen.current = new Set(openIds);
    if (opening.length === 0 && closing.length === 0) return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    // One frame for both directions: the outgoing collapse and the incoming
    // expansion start together, so the page makes a single movement.
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      closing.forEach(collapse);
      opening.forEach(expand);
    });
  }, [openIds, expand, collapse]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const onPanelTransitionEnd = (e: ReactTransitionEvent<HTMLDivElement>, id: string) => {
    if (e.propertyName !== "height" || e.target !== e.currentTarget) return;
    const el = panelRefs.current.get(id);
    if (!el) return;
    el.style.transition = "";
    if (openRef.current.has(id)) {
      // auto, not the measured px: later reflow or a text-wrap change stays correct
      el.style.height = "auto";
    } else {
      el.style.height = "0px";
      el.hidden = true;
    }
  };

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (!allowMultiple) next.clear();
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className={`ns-fdg-root ${className}`.trim()}>
      <style>{CSS}</style>

      {items.map((item) => {
        const natural = heights[item.id] ?? 0;
        const isOpen = openIds.has(item.id);
        const isPreview = !isOpen && previewId === item.id && !reduced;
        const rest = natural > 0 ? clamp(REST_MIN, natural * REST_RATIO, REST_MAX) : REST_MIN;
        const tickHeight = isOpen
          ? Math.max(REST_MIN, natural)
          : isPreview
            ? Math.max(rest, Math.min(natural, PREVIEW_MAX))
            : rest;
        const triggerId = `${baseId}-q-${item.id}`;
        const panelId = `${baseId}-a-${item.id}`;
        const state = isOpen ? "open" : isPreview ? "preview" : "rest";

        return (
          <div key={item.id} className="ns-fdg-row" data-open={isOpen}>
            <div className="ns-fdg-gutter">
              <span
                className="ns-fdg-tick"
                data-state={state}
                style={{ height: `${Math.round(tickHeight)}px` }}
                aria-hidden="true"
              />
            </div>

            <div className="ns-fdg-body">
              <h3 className="ns-fdg-h3">
                <button
                  type="button"
                  id={triggerId}
                  data-faq-trigger=""
                  className="ns-fdg-trigger"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggle(item.id)}
                  onPointerEnter={() => setPreviewId(item.id)}
                  onPointerLeave={() =>
                    setPreviewId((cur) => (cur === item.id ? null : cur))
                  }
                  onFocus={() => setPreviewId(item.id)}
                  onBlur={() => setPreviewId((cur) => (cur === item.id ? null : cur))}
                >
                  <span className="ns-fdg-question">{item.question}</span>
                  <span className="ns-fdg-sign" data-open={isOpen} aria-hidden="true">
                    <span className="ns-fdg-sign-h" />
                    <span className="ns-fdg-sign-v" />
                  </span>
                </button>
              </h3>

              <div
                id={panelId}
                ref={(el) => {
                  if (!el) {
                    panelRefs.current.delete(item.id);
                    return;
                  }
                  panelRefs.current.set(item.id, el);
                  if (initialized.current.has(item.id)) return;
                  initialized.current.add(item.id);
                  if (openIds.has(item.id)) {
                    el.style.height = "auto";
                  } else {
                    el.style.height = "0px";
                    el.hidden = true;
                  }
                }}
                data-faq-panel=""
                data-open={isOpen}
                role="region"
                aria-labelledby={triggerId}
                className="ns-fdg-panel"
                onTransitionEnd={(e) => onPanelTransitionEnd(e, item.id)}
              >
                <div className="ns-fdg-answer">{item.answer}</div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Zero-height probe: its body cell is exactly the answer column's width,
          which is what the offscreen mirror is sized to before measuring. */}
      <div className="ns-fdg-row ns-fdg-probe-row" aria-hidden="true">
        <div className="ns-fdg-gutter" />
        <div className="ns-fdg-body" ref={probeRef} />
      </div>

      {/* Offscreen mirror — every answer at the real column width, measured once
          per width change, never per frame. */}
      <div className="ns-fdg-mirror" ref={mirrorRef} aria-hidden="true">
        {items.map((item) => (
          <div key={item.id} data-mirror-id={item.id} className="ns-fdg-answer">
            {item.answer}
          </div>
        ))}
      </div>
    </div>
  );
}

const CSS = `
.ns-fdg-root{position:relative;width:100%;color:var(--foreground);}
.ns-fdg-root *,.ns-fdg-root *::before,.ns-fdg-root *::after{box-sizing:border-box;}

.ns-fdg-row{display:flex;align-items:flex-start;gap:22px;}
.ns-fdg-row + .ns-fdg-row{border-top:1px solid var(--border);}

.ns-fdg-gutter{position:relative;flex:0 0 3px;width:3px;align-self:stretch;min-height:1px;}
.ns-fdg-tick{
  position:absolute;left:0;top:18px;width:3px;
  border-radius:9999px;
  background-color:var(--border);
  transition:height 220ms ${EASE}, background-color 220ms ease;
}
.ns-fdg-tick[data-state="preview"]{
  background-color:color-mix(in oklab, var(--accent) 55%, transparent);
}
.ns-fdg-tick[data-state="open"]{
  background-color:var(--accent);
  transition:height ${OPEN_MS}ms ${EASE}, background-color 160ms ease;
}

.ns-fdg-body{flex:1 1 auto;min-width:0;}
.ns-fdg-h3{margin:0;font-size:inherit;font-weight:inherit;}
.ns-fdg-trigger{
  display:flex;width:100%;align-items:center;justify-content:space-between;gap:20px;
  padding:16px 0;border:0;background:none;
  color:var(--foreground);font:inherit;font-size:15px;line-height:1.4;
  text-align:left;cursor:pointer;border-radius:6px;
}
.ns-fdg-trigger:hover .ns-fdg-question{color:var(--accent);}
.ns-fdg-trigger:focus-visible{outline:2px solid var(--accent);outline-offset:3px;}
.ns-fdg-question{min-width:0;transition:color 160ms ease;}

.ns-fdg-sign{position:relative;flex:0 0 10px;width:10px;height:10px;}
.ns-fdg-sign-h,.ns-fdg-sign-v{position:absolute;left:0;top:0;background-color:var(--muted);}
.ns-fdg-sign-h{width:10px;height:1.5px;top:4.25px;}
.ns-fdg-sign-v{width:1.5px;height:10px;left:4.25px;transition:transform 200ms ${EASE};transform-origin:center;}
.ns-fdg-sign[data-open="true"] .ns-fdg-sign-v{transform:scaleY(0);}

.ns-fdg-panel{overflow:hidden;height:0;}
.ns-fdg-panel[hidden]{display:none;}
.ns-fdg-answer{padding:0 0 20px 0;color:var(--muted);font-size:13.5px;line-height:1.65;}
.ns-fdg-answer p{margin:0;}
.ns-fdg-answer p + p{margin-top:11px;}

.ns-fdg-row.ns-fdg-probe-row{height:0;overflow:hidden;border:0;padding:0;pointer-events:none;}

.ns-fdg-mirror{
  position:absolute;left:-9999px;top:0;
  visibility:hidden;pointer-events:none;
}

@media (prefers-reduced-motion: reduce){
  .ns-fdg-tick,.ns-fdg-sign-v,.ns-fdg-question{transition-duration:0ms !important;}
}
`;
