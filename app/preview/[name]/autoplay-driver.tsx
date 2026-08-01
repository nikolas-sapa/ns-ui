"use client";

import { useEffect } from "react";
import type { AutoplaySpec } from "@/lib/autoplay";

/**
 * The shared autoplay driver.
 *
 * Mounted only for `?embed=1&autoplay=1` — i.e. only inside a landing-page
 * card. `/preview/<name>` with no params never renders this, so the honest
 * reference page receives no synthetic input at all.
 *
 * It synthesises the one kind of input the component is waiting for
 * (see `lib/autoplay.ts`) on a single rAF loop, and dispatches it *directly to
 * the target element* rather than through hit testing. That matters: the embed
 * wrapper is `inert`, and `inert` removes the subtree from hit testing —
 * `document.elementFromPoint()` over an inert demo returns `<body>` (measured).
 * Programmatic `dispatchEvent` is unaffected by `inert`, so the events land
 * while the focus protection that `inert` provides — the thing that stopped a
 * mount-time `focus()` from scrolling the *host* page ~1000px — stays exactly
 * as it was. Nothing about the embed's inert/pointer-events/tabindex handling
 * changed for this feature.
 */
export function AutoplayDriver({ spec }: { spec: AutoplaySpec }) {
  // Serialized so a fresh object identity per render can't restart the loop.
  const key = JSON.stringify(spec);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const parsed = JSON.parse(key) as AutoplaySpec;
    const root = document.querySelector<HTMLElement>("[data-autoplay-root]");
    if (!root) return;
    return start(root, parsed);
  }, [key]);

  return null;
}

// ---------------------------------------------------------------------------
// synthetic input primitives
// ---------------------------------------------------------------------------

type Pt = { x: number; y: number };

const POINTER_INIT = {
  pointerId: 1,
  pointerType: "mouse",
  isPrimary: true,
  bubbles: true,
  cancelable: true,
  composed: true,
  width: 1,
  height: 1,
  pressure: 0,
} as const;

// `button` says WHICH button changed state; `buttons` is the bitmask of what is
// currently held. They are not interchangeable: a primary-button release is
// `button: 0` with `buttons: 0`. Deriving button from the bitmask made every
// release and click `button: -1` (which means "no button changed" — correct only
// for moves), and Chromium skips the native activation behaviour of
// <input type=checkbox|radio> unless button === 0. The events dispatched fine
// and listeners ran, but `.checked` silently never flipped.
const BUTTON_EVENTS = new Set(["pointerdown", "pointerup", "click", "mousedown", "mouseup"]);

function fire(el: Element, type: string, p: Pt, buttons: number, bubbles = true) {
  const button = BUTTON_EVENTS.has(type) ? 0 : -1;
  const init: PointerEventInit = {
    ...POINTER_INIT,
    bubbles,
    view: window,
    clientX: p.x,
    clientY: p.y,
    screenX: p.x,
    screenY: p.y,
    buttons,
    button,
    pressure: buttons ? 0.5 : 0,
  };
  el.dispatchEvent(new PointerEvent(type, init));
  // Mouse mirrors: plenty of components listen for `mousemove`/`click` only.
  const mouseType = MOUSE_MIRROR[type];
  if (mouseType) {
    el.dispatchEvent(
      new MouseEvent(mouseType, { ...init, button: BUTTON_EVENTS.has(mouseType) ? 0 : -1 }),
    );
  }
}

const MOUSE_MIRROR: Record<string, string | undefined> = {
  pointerdown: "mousedown",
  pointerup: "mouseup",
  pointermove: "mousemove",
  pointerover: "mouseover",
  pointerout: "mouseout",
  pointerenter: "mouseenter",
  pointerleave: "mouseleave",
};

// ---------------------------------------------------------------------------
// keyboard synthesis (the `type` mode)
// ---------------------------------------------------------------------------

/**
 * A synthetic keystroke has to emulate a real browser closely enough to drive
 * BOTH kinds of keyboard component:
 *
 *  - keyboard-first controls (otp-reel) `preventDefault()` the digit
 *    `keydown` and drive themselves from `event.key`, never letting the value
 *    change natively — so no `input` must follow;
 *  - ordinary controlled inputs let the `keydown` through and update from the
 *    `input` event React listens to via `onChange` — so the value must be set
 *    (through the native setter, or React's value tracking swallows it) and an
 *    `input` event fired.
 *
 * The browser resolves that fork with `defaultPrevented`: if the `keydown` was
 * cancelled, it inserts nothing. We do exactly the same — dispatch a
 * *cancelable* `keydown` (required, or `defaultPrevented` never flips and both
 * paths run, double-driving the field), and only synthesise the value change +
 * `input` when it was NOT prevented. React runs `onKeyDown` synchronously
 * inside `dispatchEvent`, so the flag is accurate the instant dispatch returns.
 *
 * Focus is irrelevant to whether these land — React delegates from the root
 * container, so a bubbling event reaches `onKeyDown`/`onChange` without the
 * element being `document.activeElement`. That is what lets the `type` mode
 * work under `inert`, where focus cannot move at all.
 */

function describeKey(ch: string): { key: string; code: string; keyCode: number } {
  if (/[0-9]/.test(ch)) return { key: ch, code: `Digit${ch}`, keyCode: ch.charCodeAt(0) };
  if (/[a-z]/i.test(ch)) {
    const u = ch.toUpperCase();
    return { key: ch, code: `Key${u}`, keyCode: u.charCodeAt(0) };
  }
  if (ch === " ") return { key: " ", code: "Space", keyCode: 32 };
  return { key: ch, code: "", keyCode: ch.charCodeAt(0) };
}

/** dispatchEvent returns false iff a cancelable event was `preventDefault()`ed. */
function fireKey(el: Element, type: string, k: ReturnType<typeof describeKey>, cancelable: boolean) {
  return el.dispatchEvent(
    new KeyboardEvent(type, {
      key: k.key,
      code: k.code,
      keyCode: k.keyCode,
      which: k.keyCode,
      bubbles: true,
      cancelable,
      composed: true,
      view: window,
    }),
  );
}

function isTextField(el: Element): el is HTMLInputElement | HTMLTextAreaElement {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

/** Bypass React's value tracking so a controlled input actually re-renders. */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}

function typeChar(el: HTMLElement, ch: string) {
  try {
    (el as HTMLElement).focus?.();
  } catch {
    /* inert — focus is a no-op, events still land */
  }
  const k = describeKey(ch);
  const notPrevented = fireKey(el, "keydown", k, true);
  if (notPrevented && isTextField(el)) {
    el.dispatchEvent(
      new InputEvent("beforeinput", { bubbles: true, cancelable: true, composed: true, inputType: "insertText", data: ch }),
    );
    setNativeValue(el, (el.value ?? "") + ch);
    el.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "insertText", data: ch }));
  }
  fireKey(el, "keyup", k, false);
}

function backspaceKey(el: HTMLElement) {
  try {
    (el as HTMLElement).focus?.();
  } catch {
    /* inert */
  }
  const k = { key: "Backspace", code: "Backspace", keyCode: 8 };
  const notPrevented = fireKey(el, "keydown", k, true);
  if (notPrevented && isTextField(el)) {
    el.dispatchEvent(
      new InputEvent("beforeinput", { bubbles: true, cancelable: true, composed: true, inputType: "deleteContentBackward", data: null }),
    );
    setNativeValue(el, (el.value ?? "").slice(0, -1));
    el.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, inputType: "deleteContentBackward", data: null }));
  }
  fireKey(el, "keyup", k, false);
}

/**
 * The input(s) the `type` mode drives. Several matches ⇒ a per-box control
 * (an OTP with one `<input>` per digit): character k is dispatched to match k,
 * because the demo is `inert` and the component's own focus-advance is a no-op,
 * so every keystroke would otherwise pile into the first box. One match ⇒ the
 * whole string goes there. No match ⇒ the demo root, so it never throws.
 */
function resolveInputs(root: HTMLElement, selector: string | undefined): HTMLElement[] {
  const sel = selector ?? "input, textarea, [contenteditable]";
  const all = Array.from(root.querySelectorAll<HTMLElement>(sel)).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  return all.length ? all : [root];
}

const pickEl = (els: HTMLElement[], k: number) =>
  els.length > 1 ? els[Math.min(k, els.length - 1)] : els[0];

function clearAll(els: HTMLElement[], len: number) {
  if (els.length > 1) {
    for (let i = els.length - 1; i >= 0; i--) backspaceKey(els[i]);
  } else {
    for (let i = 0; i < len; i++) backspaceKey(els[0]);
  }
}

/**
 * Deepest element containing the point, walking down from `root`.
 * Replaces `document.elementFromPoint`, which is useless here: `inert` takes
 * the demo out of hit testing, so it always answers `<body>`.
 */
function hitTest(root: HTMLElement, p: Pt): HTMLElement {
  let node = root;
  for (let depth = 0; depth < 32; depth++) {
    const kids = node.children;
    let next: HTMLElement | null = null;
    // Last child first: later siblings paint on top.
    for (let i = kids.length - 1; i >= 0; i--) {
      const k = kids[i];
      if (!(k instanceof HTMLElement)) continue;
      const r = k.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (p.x < r.left || p.x > r.right || p.y < r.top || p.y > r.bottom) continue;
      const cs = getComputedStyle(k);
      if (cs.pointerEvents === "none" || cs.visibility === "hidden") continue;
      next = k;
      break;
    }
    if (!next) return node;
    node = next;
  }
  return node;
}

function chainOf(el: HTMLElement, root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  let n: HTMLElement | null = el;
  while (n) {
    out.push(n);
    if (n === root) break;
    n = n.parentElement;
  }
  return out.reverse(); // root -> leaf
}

/**
 * Hover-state machine. `pointerenter`/`pointerleave` do not bubble, so they
 * have to be dispatched on every element entering or leaving the chain —
 * that is what wakes `pointerleave`-on-container components like dock-cursor-magnify.
 */
class Hover {
  private chain: HTMLElement[] = [];
  constructor(private root: HTMLElement) {}

  move(p: Pt, buttons = 0) {
    const leaf = hitTest(this.root, p);
    const next = chainOf(leaf, this.root);
    const prev = this.chain;
    if (prev[prev.length - 1] !== leaf) {
      if (prev.length) fire(prev[prev.length - 1], "pointerout", p, buttons);
      for (let i = prev.length - 1; i >= 0; i--) {
        if (!next.includes(prev[i])) fire(prev[i], "pointerleave", p, buttons, false);
      }
      if (next.length) fire(leaf, "pointerover", p, buttons);
      for (const el of next) {
        if (!prev.includes(el)) fire(el, "pointerenter", p, buttons, false);
      }
      this.chain = next;
    }
    fire(leaf, "pointermove", p, buttons);
    return leaf;
  }

  clear(p: Pt) {
    const prev = this.chain;
    if (!prev.length) return;
    fire(prev[prev.length - 1], "pointerout", p, 0);
    for (let i = prev.length - 1; i >= 0; i--) fire(prev[i], "pointerleave", p, 0, false);
    this.chain = [];
  }
}

// ---------------------------------------------------------------------------
// geometry
// ---------------------------------------------------------------------------

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clampInset = (v: number) => (v < -0.45 ? -0.45 : v > 0.45 ? 0.45 : v);
/** ease-in-out, so synthetic motion reads as a hand and not a metronome. */
const smooth = (t: number) => t * t * (3 - 2 * t);
/** 0→1→0 over one cycle. */
const pingPong = (t: number) => (t < 0.5 ? smooth(t * 2) : smooth(2 - t * 2));

type Box = { x: number; y: number; w: number; h: number };

/**
 * The box a path or drag is computed over: the union of every element matching
 * `selector`, or the demo root when the selector is absent or matches nothing.
 *
 * The union matters. A demo's root is usually `min-h-screen`, so its centre is
 * nowhere near the thing worth demonstrating — a sweep across the root's
 * vertical centre missed dock-cursor-magnify's row entirely. `target: "button"`
 * unions all nine dock items into exactly the dock. Positive `inset` shrinks
 * the box, negative overshoots it (so a sweep can enter and leave).
 */
function boxOf(root: HTMLElement, selector: string | undefined, inset: number): Box {
  let l = Infinity;
  let t = Infinity;
  let r = -Infinity;
  let b = -Infinity;
  const matches = selector ? root.querySelectorAll<HTMLElement>(selector) : [];
  for (const el of matches) {
    const q = el.getBoundingClientRect();
    if (!q.width || !q.height) continue;
    l = Math.min(l, q.left);
    t = Math.min(t, q.top);
    r = Math.max(r, q.right);
    b = Math.max(b, q.bottom);
  }
  if (!Number.isFinite(l)) {
    const q = root.getBoundingClientRect();
    l = q.left;
    t = q.top;
    r = q.right;
    b = q.bottom;
  }
  const w = r - l;
  const h = b - t;
  const ix = w * inset;
  const iy = h * inset;
  return { x: l + ix, y: t + iy, w: Math.max(1, w - ix * 2), h: Math.max(1, h - iy * 2) };
}

function pointOnPath(shape: string, t: number, b: Box): Pt {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  if (shape === "orbit") {
    const a = t * Math.PI * 2 - Math.PI;
    return { x: cx + (b.w / 2) * Math.cos(a), y: cy + (b.h / 2) * Math.sin(a) };
  }
  if (shape === "figure8") {
    const a = t * Math.PI * 2;
    return { x: cx + (b.w / 2) * Math.sin(a), y: cy + (b.h / 2) * Math.sin(a * 2) * 0.5 };
  }
  // sweep: left → right → left across the box at its vertical centre.
  return { x: b.x + b.w * pingPong(t), y: cy };
}

function resolveTarget(root: HTMLElement, selector: string | undefined, fallback: string | null) {
  const sel = selector ?? fallback;
  if (!sel) return root;
  return root.querySelector<HTMLElement>(sel) ?? root;
}

// ---------------------------------------------------------------------------
// the loop
// ---------------------------------------------------------------------------

/** Fraction of a pointer-path cycle spent moving; the rest is a pointer-out beat. */
const ACTIVE = 0.86;
/** Pointer work is throttled to ~30Hz — 60Hz buys nothing and costs 12x here. */
const STEP_MS = 33;
/** `type`: quiet beat after a cleared string, before the loop re-types it. */
const TYPE_CLEAR_REST = 900;

function start(root: HTMLElement, spec: AutoplaySpec): () => void {
  // `type` has no fixed period: one cycle is text/cps + the rest beat + a clear
  // pause, computed from the descriptor rather than read off `period`.
  const period =
    spec.mode === "type"
      ? Math.max(
          400,
          (spec.text ?? "").length * (1000 / Math.max(0.5, spec.cps ?? 3)) +
            Math.max(0, spec.hold ?? 1600) +
            TYPE_CLEAR_REST,
        )
      : Math.max(400, spec.period ?? 4000);
  const delay = Math.max(0, spec.delay ?? 600);
  const hover = new Hover(root);

  // Some components call setPointerCapture() from their pointerdown handler.
  // A synthetic pointerId matches no active pointer, so the call can throw and
  // abort the handler mid-way. Swallow it for the life of the driver only.
  const proto = Element.prototype;
  const originals = {
    setPointerCapture: proto.setPointerCapture,
    releasePointerCapture: proto.releasePointerCapture,
  };
  const guard = <T extends (this: Element, id: number) => void>(fn: T) =>
    function (this: Element, id: number) {
      try {
        fn.call(this, id);
      } catch {
        /* synthetic pointer — capture is meaningless, not an error */
      }
    };
  proto.setPointerCapture = guard(originals.setPointerCapture);
  proto.releasePointerCapture = guard(originals.releasePointerCapture);

  let raf = 0;
  let t0 = 0;
  let lastStep = -Infinity;
  let down: { at: Pt; el: HTMLElement } | null = null;
  let cycle = -1;
  // `type` state, reset each cycle in the `fresh` branch below.
  let typed = 0;
  let typeCleared = false;
  let typeEls: HTMLElement[] = [];

  const release = (p: Pt) => {
    if (!down) return;
    fire(down.el, "pointerup", p, 0);
    fire(down.el, "click", p, 0);
    down = null;
  };

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (!t0) t0 = now;
    const elapsed = now - t0 - delay;
    if (elapsed < 0) return;
    if (now - lastStep < STEP_MS) return;
    lastStep = now;

    const t = (elapsed % period) / period;
    const n = Math.floor(elapsed / period);
    const fresh = n !== cycle;
    cycle = n;

    switch (spec.mode) {
      case "pointer-path": {
        const box = boxOf(root, spec.target, clampInset(spec.inset ?? 0.12));
        if (t <= ACTIVE) hover.move(pointOnPath(spec.path ?? "sweep", t / ACTIVE, box));
        else hover.clear(pointOnPath(spec.path ?? "sweep", 1, box));
        break;
      }

      case "scroll": {
        const el = spec.scroller ? root.querySelector<HTMLElement>(spec.scroller) : null;
        const scroller = el ?? document.scrollingElement ?? document.documentElement;
        const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        if (!max) break;
        const [from, to] = spec.range ?? [0, 1];
        const f = clamp01(from) + (clamp01(to) - clamp01(from)) * pingPong(t);
        scroller.scrollTop = f * max;
        break;
      }

      case "press": {
        const el = resolveTarget(root, spec.target, "button");
        const r = el.getBoundingClientRect();
        const p = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        const hold = Math.min(period - 200, Math.max(60, spec.hold ?? 900));
        const at = t * period;
        if (fresh) {
          release(p);
          hover.move(p);
        }
        if (at < hold) {
          if (!down) {
            down = { at: p, el };
            fire(el, "pointerdown", p, 1);
          } else {
            // Keep the press alive for components tracking movement while held.
            hover.move(p, 1);
          }
        } else if (down) {
          release(p);
          hover.clear(p);
        }
        break;
      }

      case "drag": {
        const b = boxOf(root, spec.target, clampInset(spec.inset ?? 0));
        const [fx, fy] = spec.from ?? [0.2, 0.5];
        const [tx, ty] = spec.to ?? [0.8, 0.5];
        const a = { x: b.x + b.w * fx, y: b.y + b.h * fy };
        const z = { x: b.x + b.w * tx, y: b.y + b.h * ty };
        if (fresh) {
          release(a);
          hover.move(a);
        }
        if (t < 0.08) {
          if (!down) {
            down = { at: a, el: hitTest(root, a) };
            fire(down.el, "pointerdown", a, 1);
          }
        } else if (t < 0.86) {
          const u = pingPong((t - 0.08) / 0.78);
          hover.move({ x: a.x + (z.x - a.x) * u, y: a.y + (z.y - a.y) * u }, 1);
        } else if (down) {
          release(z);
          hover.clear(z);
        }
        break;
      }

      case "type": {
        const text = spec.text ?? "";
        if (!text) break;
        const charMs = 1000 / Math.max(0.5, spec.cps ?? 3);
        const holdMs = Math.max(0, spec.hold ?? 1600);
        const typePhaseEnd = text.length * charMs;
        const inCycle = t * period;
        if (fresh) {
          typed = 0;
          typeCleared = false;
          typeEls = resolveInputs(root, spec.target);
        }
        // Type each character as its scheduled moment passes. The `while` also
        // catches up any keystroke a throttled frame stepped over, so the full
        // string always lands even at low frame budgets.
        const want =
          inCycle < typePhaseEnd
            ? Math.min(text.length, Math.floor(inCycle / charMs) + 1)
            : text.length;
        while (typed < want) {
          typeChar(pickEl(typeEls, typed), text[typed]);
          typed++;
        }
        // After the string rests for `hold`, clear it once so the loop repeats.
        if (!typeCleared && inCycle >= typePhaseEnd + holdMs) {
          clearAll(typeEls, text.length);
          typeCleared = true;
        }
        break;
      }
    }
  };

  const play = () => {
    if (!raf) {
      lastStep = -Infinity;
      raf = requestAnimationFrame(tick);
    }
  };
  const pause = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  const onVis = () => (document.hidden ? pause() : play());
  document.addEventListener("visibilitychange", onVis);
  play();

  return () => {
    document.removeEventListener("visibilitychange", onVis);
    pause();
    const last = down?.at ?? { x: -1, y: -1 };
    release(last);
    hover.clear(last);
    proto.setPointerCapture = originals.setPointerCapture;
    proto.releasePointerCapture = originals.releasePointerCapture;
  };
}
