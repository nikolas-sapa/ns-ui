"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type TextareaHTMLAttributes,
} from "react";

// ---------------------------------------------------------------------------
// ProofRise — an autosize textarea that grows like dough proofing rather than
// reflowing like a spreadsheet cell. A hidden mirror div (same font, padding
// and width as the real textarea) remeasures target content height on every
// input event; the wrapper's height is driven by a registered CSS custom
// property (`--proof-h`, animatable via @property) so the browser's own
// compositor eases it, not React state on a hot path. Grows ease-out-expo in
// 180ms; shrinks slower on the same curve (320ms) so the surface never snaps
// out from under the cursor; a paste that jumps more than 40px is stretched
// to 400ms so it reads as one continuous breath instead of a layout pop. The
// live <textarea> itself is resized instantly and un-animated with
// overflow hidden — the wrapper is what clips/reveals it — so the caret is
// never blocked mid-rise. Before starting a new rise, the mirror also checks
// whether the caret's own line already sits below the wrapper's current
// (possibly mid-transition) height; if a fast edit has outrun the animation,
// the wrapper snaps instantly to just behind the caret line first, then
// animates the rest, so the caret is never left invisible under the clip.
// A hairline bottom border brightens from --border toward --ns-muted for the
// duration of a rise, via a class toggle, never a canvas or SVG.
// prefers-reduced-motion: all of the above still runs (the target height is
// still computed correctly), it just applies without a transition — the
// standard instant-reflow autosize pattern.
// ---------------------------------------------------------------------------

const GROW_MS = 180;
const SHRINK_MS = 320;
const PASTE_MS = 400;
const PASTE_THRESHOLD_PX = 40;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)"; // ease-out-expo shaped

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function escapeForMirror(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
}

let propertyRegistered = false;
function ensureCustomProperty() {
  if (propertyRegistered || typeof window === "undefined") return;
  propertyRegistered = true;
  // Animatable custom property backing the wrapper's height. Registering
  // this makes `--proof-h` interpolate as a <length> instead of the default
  // discrete (jump-cut) custom-property behavior — that interpolation IS the
  // rise. Feature-detected: unsupported browsers just get an unanimated
  // custom property, which the instant JS-set height fallback still resizes
  // correctly (no visual breakage, only the swell is lost).
  const CSSAny = window.CSS as unknown as {
    registerProperty?: (def: {
      name: string;
      syntax: string;
      inherits: boolean;
      initialValue: string;
    }) => void;
  };
  try {
    CSSAny.registerProperty?.({
      name: "--proof-h",
      syntax: "<length>",
      inherits: false,
      initialValue: "0px",
    });
  } catch {
    // already registered (e.g. fast refresh / multiple instances) — fine
  }
}

export interface ProofRiseProps
  extends Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    "rows" | "style" | "id"
  > {
  /** visible label rendered above the field; omit and pass your own htmlFor/aria-label if you supply one externally */
  label?: string;
  /** minimum height in lines; default 1 */
  minRows?: number;
  /** maximum height in lines before it becomes a normal scrolling textarea; default unbounded */
  maxRows?: number;
  /** id for the textarea + label association; auto-generated if omitted */
  id?: string;
  className?: string;
}

export function ProofRise({
  label,
  minRows = 1,
  maxRows,
  id,
  className = "",
  onChange,
  defaultValue,
  value,
  ...textareaProps
}: ProofRiseProps) {
  const autoId = useId();
  const fieldId = id ?? `textarea-autosize-swell-${autoId}`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const pasteFlagRef = useRef(false);
  const riseTimerRef = useRef<number | undefined>(undefined);
  const baselineRef = useRef({ oneLine: 24, lineHeight: 20 });
  const boundsRef = useRef({ min: 24, max: Infinity });
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChangeMq = () => setReduced(mq.matches);
    mq.addEventListener("change", onChangeMq);
    return () => mq.removeEventListener("change", onChangeMq);
  }, []);

  useEffect(() => {
    ensureCustomProperty();
  }, []);

  useEffect(() => {
    const measure = (skipAnimation: boolean, paste: boolean) => {
      const ta = taRef.current;
      const mirror = mirrorRef.current;
      const wrap = wrapRef.current;
      if (!ta || !mirror || !wrap) return;

      // baseline: one line's height + the pure line-height increment, used
      // to derive min/max bounds and the "is the caret behind the clip"
      // guard below. Cheap enough to redo every measure — it only touches
      // an offscreen mirror, never triggers a real paint until we assign
      // the wrapper height at the end.
      const cs = getComputedStyle(ta);
      let lineHeight = parseFloat(cs.lineHeight);
      if (Number.isNaN(lineHeight)) lineHeight = parseFloat(cs.fontSize) * 1.5;
      mirror.textContent = " ";
      const oneLine = mirror.scrollHeight || lineHeight;
      baselineRef.current = { oneLine, lineHeight };
      const min = oneLine + Math.max(0, minRows - 1) * lineHeight;
      const max = maxRows
        ? oneLine + Math.max(0, maxRows - 1) * lineHeight
        : Infinity;
      boundsRef.current = { min, max };

      const val = ta.value;
      let caret = val.length;
      try {
        const sel = ta.selectionStart;
        if (sel != null) caret = sel;
      } catch {
        // some input types refuse the selection API — caret defaults to end
      }
      const before = val.slice(0, caret);
      const after = val.slice(caret);
      mirror.innerHTML = `${escapeForMirror(before)}<span data-caret>​</span>${
        escapeForMirror(after) || "​"
      }`;
      const natural = mirror.scrollHeight;
      const total = clamp(natural, min, max);
      const marker = mirror.querySelector<HTMLElement>("[data-caret]");
      const caretBottom = marker
        ? marker.offsetTop + marker.offsetHeight
        : total;

      // the live textarea matches its content instantly and never animates,
      // so the caret is only ever hidden by the wrapper's clip during a rise
      // — never by the textarea's own overflow. Below maxRows that overflow
      // stays hidden (there's nothing to scroll, content always fits); past
      // it the content genuinely exceeds the capped height, so the textarea
      // gets its own scrollbar rather than silently clipping unreachable
      // lines and the caret along with them.
      ta.style.overflowY = natural > max ? "auto" : "hidden";
      ta.style.height = `${total}px`;

      if (skipAnimation || reduced) {
        wrap.style.transitionDuration = "0ms";
        wrap.style.setProperty("--proof-h", `${total}px`);
        void wrap.offsetHeight;
        return;
      }

      let h0 = parseFloat(getComputedStyle(wrap).height);
      if (!Number.isFinite(h0)) h0 = total;

      // a fast edit (or an animation still catching up) can leave the
      // caret's own line below the wrapper's current clipped height —
      // snap instantly to just behind that line first so the caret is
      // never invisible for the length of a rise, then animate the rest
      if (caretBottom - h0 > lineHeight + 2) {
        const snap = Math.min(total, caretBottom - lineHeight);
        wrap.style.transitionDuration = "0ms";
        wrap.style.setProperty("--proof-h", `${snap}px`);
        void wrap.offsetHeight;
        h0 = snap;
      }

      const growing = total > h0 + 0.5;
      const shrinking = total < h0 - 0.5;
      let dur = GROW_MS;
      if (shrinking) dur = SHRINK_MS;
      else if (growing && paste && total - h0 > PASTE_THRESHOLD_PX) {
        dur = PASTE_MS;
      }

      wrap.style.transitionDuration = `${dur}ms`;
      wrap.style.setProperty("--proof-h", `${total}px`);

      window.clearTimeout(riseTimerRef.current);
      if (growing) {
        wrap.classList.add("ns-proof-rising");
        riseTimerRef.current = window.setTimeout(() => {
          wrap.classList.remove("ns-proof-rising");
        }, dur);
      } else {
        wrap.classList.remove("ns-proof-rising");
      }
    };

    // first paint: sizes to the initial value with no transition
    measure(true, false);

    const ta = taRef.current;
    const wrap = wrapRef.current;
    if (!ta || !wrap) return;

    const handleInput = () => {
      const wasPaste = pasteFlagRef.current;
      pasteFlagRef.current = false;
      measure(false, wasPaste);
    };
    const handlePaste = () => {
      pasteFlagRef.current = true;
    };

    ta.addEventListener("input", handleInput);
    ta.addEventListener("paste", handlePaste);

    // a container resize can change how the value wraps; resnap instantly —
    // not a rise, just keeping the true content height honest
    const ro = new ResizeObserver(() => measure(true, false));
    ro.observe(ta);

    return () => {
      ta.removeEventListener("input", handleInput);
      ta.removeEventListener("paste", handlePaste);
      ro.disconnect();
      window.clearTimeout(riseTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, minRows, maxRows]);

  // controlled `value` changes (not driven by the field's own input event)
  // still need to be measured — e.g. a parent clearing the field on submit
  useEffect(() => {
    if (value === undefined) return;
    const ta = taRef.current;
    if (!ta) return;
    const evt = new Event("input", { bubbles: true });
    ta.dispatchEvent(evt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const sharedFont =
    "w-full resize-none bg-transparent px-3.5 py-2.5 font-sans text-sm leading-relaxed text-foreground";

  return (
    <div className={className}>
      <style>{`
@property --proof-h {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}
.ns-proof-wrap {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid var(--border);
  border-bottom-width: 1px;
  height: var(--proof-h);
  transition-property: --proof-h, border-color;
  transition-timing-function: ${EASE};
  transition-duration: ${GROW_MS}ms;
}
.ns-proof-wrap.ns-proof-rising {
  border-color: var(--ns-muted);
}
.ns-proof-wrap:focus-within {
  border-color: var(--ns-accent);
}
.ns-proof-textarea {
  display: block;
  outline: none;
  overflow: hidden;
}
@media (prefers-reduced-motion: reduce) {
  .ns-proof-wrap {
    transition-duration: 0ms;
  }
}
`}</style>

      {label ? (
        <label
          htmlFor={fieldId}
          className="mb-1.5 block text-xs text-ns-muted"
        >
          {label}
        </label>
      ) : null}

      <div
        ref={wrapRef}
        className="ns-proof-wrap bg-background"
        // a sane one-row default painted before the measuring effect ever
        // runs — otherwise --proof-h's registered 0px initial value collapses
        // the field for a frame on first paint. The effect overwrites this
        // with the precisely measured height immediately, unanimated.
        style={{ ["--proof-h" as string]: "2.75rem" } as CSSProperties}
      >
        <textarea
          ref={taRef}
          id={fieldId}
          rows={1}
          className={`ns-proof-textarea ${sharedFont} placeholder:text-ns-muted/70`}
          defaultValue={defaultValue}
          value={value}
          onChange={onChange}
          {...textareaProps}
        />
        <div
          ref={mirrorRef}
          aria-hidden
          className={`ns-proof-textarea pointer-events-none absolute inset-x-0 top-0 select-none whitespace-pre-wrap break-words ${sharedFont}`}
          style={{ visibility: "hidden", height: "auto" }}
        />
      </div>
    </div>
  );
}
