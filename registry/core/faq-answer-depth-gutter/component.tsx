"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type TransitionEvent as ReactTransitionEvent,
} from "react";

// ---------------------------------------------------------------------------
// FaqDepthGutter — a plain FAQ accordion.
//
// Real button semantics (Tab/Enter/Space are native, no keydown handler),
// aria-expanded on the trigger, aria-controls -> a role=region panel labelled
// by the trigger. Opening eases the panel 0 -> scrollHeight, then pins it to
// height:auto on transitionend so later reflow stays correct; closing pins
// auto back to px, forces a reflow and eases to 0, and `hidden` goes on only
// after that ends, so a screen reader never sees a half-collapsed region.
// A 2px --accent rail marks the open row. prefers-reduced-motion toggles
// height with no transition. Tokens only, zero dependencies.
// ---------------------------------------------------------------------------

const OPEN_MS = 260;
const CLOSE_MS = 200;
const EASE = "cubic-bezier(0.22,1,0.36,1)";

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

function prefersReduced() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function FaqDepthGutter({
  items,
  allowMultiple = false,
  defaultOpen = [],
  className = "",
}: FaqDepthGutterProps) {
  const baseId = useId().replace(/:/g, "");
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(defaultOpen));

  const panelRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const initialized = useRef<Set<string>>(new Set());
  const prevOpen = useRef<Set<string>>(new Set(defaultOpen));
  const openRef = useRef(openIds);

  openRef.current = openIds;

  const expand = useCallback((id: string) => {
    const el = panelRefs.current.get(id);
    if (!el) return;
    el.hidden = false;
    el.style.transition = "none";
    el.style.height = "0px";
    void el.offsetHeight; // forced reflow: commit the start height
    if (prefersReduced()) {
      el.style.transition = "";
      el.style.height = "auto";
      return;
    }
    el.style.transition = `height ${OPEN_MS}ms ${EASE}`;
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const collapse = useCallback((id: string) => {
    const el = panelRefs.current.get(id);
    if (!el) return;
    el.style.transition = "none";
    el.style.height = `${el.offsetHeight}px`; // pin height:auto back to px
    void el.offsetHeight; // forced reflow before easing down
    if (prefersReduced()) {
      el.style.transition = "";
      el.style.height = "0px";
      el.hidden = true;
      return;
    }
    el.style.transition = `height ${CLOSE_MS}ms ${EASE}`;
    el.style.height = "0px";
  }, []);

  useEffect(() => {
    openIds.forEach((id) => {
      if (!prevOpen.current.has(id)) expand(id);
    });
    prevOpen.current.forEach((id) => {
      if (!openIds.has(id)) collapse(id);
    });
    prevOpen.current = new Set(openIds);
  }, [openIds, expand, collapse]);

  const onPanelTransitionEnd = (e: ReactTransitionEvent<HTMLDivElement>, id: string) => {
    if (e.propertyName !== "height" || e.target !== e.currentTarget) return;
    const el = panelRefs.current.get(id);
    if (!el) return;
    el.style.transition = "";
    if (openRef.current.has(id)) {
      // auto, not px: later reflow or a text-wrap change stays correct
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
        const isOpen = openIds.has(item.id);
        const triggerId = `${baseId}-q-${item.id}`;
        const panelId = `${baseId}-a-${item.id}`;

        return (
          <div key={item.id} className="ns-fdg-row" data-open={isOpen}>
            <h3 className="ns-fdg-h3">
              <button
                type="button"
                id={triggerId}
                data-faq-trigger=""
                className="ns-fdg-trigger"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
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
        );
      })}
    </div>
  );
}

const CSS = `
.ns-fdg-root{width:100%;color:var(--foreground);padding-left:14px;}
.ns-fdg-root *,.ns-fdg-root *::before,.ns-fdg-root *::after{box-sizing:border-box;}

.ns-fdg-row{position:relative;}
.ns-fdg-row + .ns-fdg-row{border-top:1px solid var(--border);}
/* Open-row rail: fixed height, so two open rows never join into one bar. */
.ns-fdg-row::before{
  content:"";position:absolute;left:-14px;top:18px;width:2px;height:18px;
  border-radius:9999px;background-color:transparent;
  transition:background-color 160ms ease;
}
.ns-fdg-row[data-open="true"]::before{background-color:var(--accent);}

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

@media (prefers-reduced-motion: reduce){
  .ns-fdg-sign-v,.ns-fdg-question{transition-duration:0ms !important;}
}
`;
