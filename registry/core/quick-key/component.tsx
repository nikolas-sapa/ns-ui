"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

// A keyboard-shortcut cheat sheet that owns the keyboard while it is up.
// Shortcuts render as physical keycaps; every real keydown that matches a
// listed combo depresses that specific cap and flashes it in --accent, and the
// event is swallowed (preventDefault + stopPropagation in the capture phase)
// so the app's own handler behind the overlay does not also fire. You can
// rehearse a shortcut and watch its keys press themselves — clicking a row
// plays the same press, one step at a time for sequences like "G then P".
//
// Everything modal comes from the native <dialog> opened with showModal():
// focus trap, background inertness, top-layer stacking, ::backdrop and
// Escape-to-close are the platform's, not a hand-rolled trap.
//
// The part that actually decides whether this works is normalization, and it
// is deliberately not a string compare. A chord is a set of required modifier
// flags plus one canonical base key. Matching runs two passes: an exact pass
// where every modifier flag must agree, then a lenient pass that ignores Shift
// for single printable characters — "?" arrives as {key:"?", shiftKey:true} on
// US layouts, so a naive exact compare against the token "?" never fires,
// while a blanket "ignore shift" would make Mod+Shift+Z indistinguishable from
// Mod+Z. Exact-first gives both. "Mod" folds to metaKey on Apple and ctrlKey
// elsewhere and never to both, so a plain Ctrl press on a Mac does not match a
// Mod shortcut. Letters and digits additionally accept e.code (KeyK / Digit1)
// when the chord carries a modifier, which is what rescues non-Latin layouts
// where e.key is a Cyrillic or Greek character.

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "OS"]);
const SEQUENCE_WINDOW_MS = 1200; // how long "G" waits for its "P"
const STEP_GAP_MS = 60; // pause between rehearsed steps

/** One chord: the modifier flags it requires plus its single base key. */
export type QuickKeyChord = {
  /** Display tokens, in the order they were authored. */
  tokens: string[];
  /** Canonical base key: "K", "?", "ESC", "ENTER", "↑", "SPACE"… */
  base: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
};

export type QuickKeyShortcut = {
  /**
   * Tokens: "Mod" | "Ctrl" | "Meta" | "Shift" | "Alt" plus one key per chord
   * ("K", "?", "Enter", "Esc", "↑", "Space"). A literal "then" token starts a
   * new chord, so ["G", "then", "P"] is a two-step sequence.
   */
  keys: string[];
  label: string;
};

export type QuickKeySection = { title: string; items: QuickKeyShortcut[] };

export interface QuickKeyProps {
  /** Grouped shortcut list. Rendered in order; sections flow into `columns`. */
  sections: QuickKeySection[];
  /** Controlled open state. Omit to run uncontrolled from `defaultOpen`. */
  open?: boolean;
  /** Uncontrolled initial state. Ignored when `open` is passed. */
  defaultOpen?: boolean;
  /** Fired for every close the platform can originate: Escape, backdrop, the close button. */
  onOpenChange?: (open: boolean) => void;
  title?: string;
  columns?: 1 | 2;
  /** Match real keydowns and flash the matching caps. Default true. */
  liveEcho?: boolean;
  /** How long a cap stays depressed, ms. Default 180. */
  echoDuration?: number;
  className?: string;
}

/* ---------------------------------------------------------------- parsing */

const NAMED_BASE: Record<string, string> = {
  esc: "ESC",
  escape: "ESC",
  enter: "ENTER",
  return: "ENTER",
  tab: "TAB",
  space: "SPACE",
  spacebar: "SPACE",
  backspace: "BACKSPACE",
  delete: "DELETE",
  del: "DELETE",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
};

/** Fold an author token or an `event.key` onto one canonical spelling. */
export function canonicalBase(raw: string): string {
  if (raw === " ") return "SPACE";
  if (raw.length === 1) return raw.toUpperCase();
  return NAMED_BASE[raw.toLowerCase()] ?? raw.toUpperCase();
}

/** Split `keys` on "then" and parse each chord. `isApple` decides what Mod folds to. */
export function parseShortcut(keys: string[], isApple: boolean): QuickKeyChord[] {
  const steps: string[][] = [[]];
  for (const token of keys) {
    if (/^(then|>)$/i.test(token)) steps.push([]);
    else steps[steps.length - 1].push(token);
  }
  return steps
    .filter((tokens) => tokens.length > 0)
    .map((tokens) => {
      const chord: QuickKeyChord = { tokens, base: "", ctrl: false, meta: false, shift: false, alt: false };
      for (const token of tokens) {
        switch (token.toLowerCase()) {
          case "mod":
            if (isApple) chord.meta = true;
            else chord.ctrl = true;
            break;
          case "ctrl":
          case "control":
          case "⌃":
            chord.ctrl = true;
            break;
          case "meta":
          case "cmd":
          case "command":
          case "⌘":
            chord.meta = true;
            break;
          case "shift":
          case "⇧":
            chord.shift = true;
            break;
          case "alt":
          case "opt":
          case "option":
          case "⌥":
            chord.alt = true;
            break;
          default:
            chord.base = canonicalBase(token);
        }
      }
      return chord;
    });
}

/** The subset of KeyboardEvent matching reads — so it can be exercised with a literal. */
export type QuickKeyEvent = {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

function baseMatches(chord: QuickKeyChord, e: QuickKeyEvent): boolean {
  if (canonicalBase(e.key) === chord.base) return true;
  // Physical-position fallback. Only for letters/digits, and only when the
  // chord carries a modifier — otherwise a Cyrillic layout typing "к" would
  // fire a bare "K" shortcut the user never asked for.
  if (!e.code || chord.base.length !== 1) return false;
  if (!chord.ctrl && !chord.meta && !chord.alt) return false;
  if (chord.base >= "A" && chord.base <= "Z") return e.code === `Key${chord.base}`;
  if (chord.base >= "0" && chord.base <= "9") return e.code === `Digit${chord.base}`;
  return false;
}

/**
 * `lenientShift` runs the second pass: Shift is treated as already baked into
 * the printed character. Only legal for a single-character base on an event
 * that actually held Shift, so it can never widen a named-key or chord match.
 */
export function chordMatchesEvent(chord: QuickKeyChord, e: QuickKeyEvent, lenientShift = false): boolean {
  if (!chord.base) return false;
  if (e.ctrlKey !== chord.ctrl || e.metaKey !== chord.meta || e.altKey !== chord.alt) return false;
  if (lenientShift) {
    if (chord.shift || !e.shiftKey || chord.base.length !== 1) return false;
  } else if (e.shiftKey !== chord.shift) {
    return false;
  }
  return baseMatches(chord, e);
}

// Dev-only tripwire. Normalization is the one part of this component that can
// break silently — a wrong fold still screenshots perfectly, it just never
// fires. These are the four cases that go wrong in practice. `warn`, not
// `error`, so a failure is loud in the console without tripping a screenshot
// gate that only watches for errors.
if (process.env.NODE_ENV !== "production") {
  const ev = (key: string, mods: Partial<QuickKeyEvent> = {}): QuickKeyEvent => ({
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...mods,
  });
  const macModK = parseShortcut(["Mod", "K"], true)[0];
  const modZ = parseShortcut(["Mod", "Z"], false)[0];
  const modShiftZ = parseShortcut(["Mod", "Shift", "Z"], false)[0];
  const question = parseShortcut(["?"], false)[0];
  const checks: [string, boolean][] = [
    ["Mod folds to Meta on Apple", chordMatchesEvent(macModK, ev("k", { metaKey: true }))],
    ["Mod does not match bare Ctrl on Apple", !chordMatchesEvent(macModK, ev("k", { ctrlKey: true }))],
    ["? matches Shift+/ only on the lenient pass", !chordMatchesEvent(question, ev("?", { shiftKey: true })) && chordMatchesEvent(question, ev("?", { shiftKey: true }), true)],
    ["Mod+Shift+Z does not collapse into Mod+Z", chordMatchesEvent(modShiftZ, ev("Z", { ctrlKey: true, shiftKey: true })) && !chordMatchesEvent(modZ, ev("Z", { ctrlKey: true, shiftKey: true }))],
    ["non-Latin layout falls back to e.code", chordMatchesEvent(macModK, ev("к", { code: "KeyK", metaKey: true }))],
  ];
  for (const [name, ok] of checks) {
    if (!ok) console.warn(`[quick-key] key normalization check failed: ${name}`);
  }
}

/* --------------------------------------------------------------- display */

function displayToken(token: string, isApple: boolean): string {
  switch (token.toLowerCase()) {
    case "mod":
      return isApple ? "⌘" : "Ctrl";
    case "meta":
    case "cmd":
    case "command":
      return isApple ? "⌘" : "Win";
    case "ctrl":
    case "control":
      return isApple ? "⌃" : "Ctrl";
    case "shift":
      return isApple ? "⇧" : "Shift";
    case "alt":
    case "opt":
    case "option":
      return isApple ? "⌥" : "Alt";
    case "space":
      return "Space";
    default:
      return token;
  }
}

const SPOKEN: Record<string, string> = {
  "⌘": "Command",
  "⇧": "Shift",
  "⌥": "Option",
  "⌃": "Control",
  "↑": "Up arrow",
  "↓": "Down arrow",
  "←": "Left arrow",
  "→": "Right arrow",
  "?": "Question mark",
  "/": "Slash",
  ",": "Comma",
  ".": "Period",
};

/** "Command plus K", so a screen reader never has to read ⌘ as an unknown glyph. */
function spokenKeys(chords: QuickKeyChord[], isApple: boolean): string {
  return chords
    .map((chord) =>
      chord.tokens
        .map((token) => {
          const shown = displayToken(token, isApple);
          return SPOKEN[shown] ?? shown;
        })
        .join(" plus ")
    )
    .join(", then ");
}

/* ------------------------------------------------------------- component */

export function QuickKey({
  sections,
  open,
  defaultOpen = false,
  onOpenChange,
  title = "Keyboard Shortcuts",
  columns = 2,
  liveEcho = true,
  echoDuration = 180,
  className = "",
}: QuickKeyProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closingRef = useRef(0);
  const flashTimers = useRef<number[]>([]);
  const pendingRef = useRef<{ row: string; step: number } | null>(null);
  const pendingTimer = useRef(0);
  const titleId = useId();

  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const isOpen = open ?? uncontrolled;
  const [flash, setFlash] = useState<string | null>(null);

  // Resolved after mount so the server and the first client render agree; SSR
  // ships the "Ctrl" spelling and Apple machines correct it in one commit.
  const [isApple, setIsApple] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const platform = nav.userAgentData?.platform || navigator.platform || navigator.userAgent || "";
    setIsApple(/mac|iphone|ipad|ipod/i.test(platform));
  }, []);

  const rows = useMemo(
    () =>
      sections.map((section, s) => ({
        ...section,
        items: section.items.map((item, i) => ({
          ...item,
          rowKey: `${s}-${i}`,
          chords: parseShortcut(item.keys, isApple),
        })),
      })),
    [sections, isApple]
  );

  const flatRows = useMemo(() => rows.flatMap((section) => section.items), [rows]);

  const clearFlashTimers = useCallback(() => {
    flashTimers.current.forEach(clearTimeout);
    flashTimers.current = [];
  }, []);

  const requestClose = useCallback(() => {
    onOpenChange?.(false);
    if (open === undefined) setUncontrolled(false);
  }, [onOpenChange, open]);

  /** Depress one step's caps for `echoDuration`. */
  const flashStep = useCallback(
    (rowKey: string, step: number) => {
      clearFlashTimers();
      setFlash(`${rowKey}:${step}`);
      flashTimers.current.push(window.setTimeout(() => setFlash(null), Math.max(40, echoDuration)));
    },
    [clearFlashTimers, echoDuration]
  );

  /** Click a row: play every step in order, so a sequence reads as a sequence. */
  const rehearse = useCallback(
    (rowKey: string, stepCount: number) => {
      clearFlashTimers();
      const beat = Math.max(40, echoDuration) + STEP_GAP_MS;
      setFlash(`${rowKey}:0`);
      for (let step = 1; step < stepCount; step += 1) {
        flashTimers.current.push(
          window.setTimeout(() => setFlash(`${rowKey}:${step}`), step * beat)
        );
      }
      flashTimers.current.push(window.setTimeout(() => setFlash(null), stepCount * beat));
    },
    [clearFlashTimers, echoDuration]
  );

  // Open/close the platform dialog from state.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (isOpen) {
      clearTimeout(closingRef.current);
      dlg.removeAttribute("data-closing");
      if (!dlg.open) dlg.showModal();
      return;
    }
    if (!dlg.open || dlg.hasAttribute("data-closing")) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      dlg.close();
      return;
    }
    // timer-driven, not transitionend-driven: a backgrounded tab must not be
    // able to strand an open dialog
    dlg.setAttribute("data-closing", "");
    closingRef.current = window.setTimeout(() => {
      dlg.removeAttribute("data-closing");
      dlg.close();
    }, 150);
  }, [isOpen]);

  // Escape fires `cancel`; `close` catches anything that closed the dialog
  // without going through the prop (form method=dialog, browser UI).
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      requestClose();
    };
    const onClose = () => {
      if (isOpen) requestClose();
    };
    const onClick = (e: MouseEvent) => {
      if (e.target === dlg) requestClose();
    };
    dlg.addEventListener("cancel", onCancel);
    dlg.addEventListener("close", onClose);
    dlg.addEventListener("click", onClick);
    return () => {
      dlg.removeEventListener("cancel", onCancel);
      dlg.removeEventListener("close", onClose);
      dlg.removeEventListener("click", onClick);
    };
  }, [isOpen, requestClose]);

  // The keyboard-ownership listener. Capture phase on window, installed only
  // while open, so nothing behind the overlay ever sees a listed combo.
  useEffect(() => {
    if (!isOpen || !liveEcho) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (MODIFIER_KEYS.has(e.key)) return;
      // Escape and Tab stay the platform's: Escape closes via `cancel`, Tab
      // walks the dialog's native focus trap.
      if (e.key === "Escape" || e.key === "Tab") {
        pendingRef.current = null;
        return;
      }
      // Enter/Space on a focused control activates it. Swallowing those would
      // make the panel's own buttons unreachable by keyboard the moment a
      // sheet happens to list Enter as a shortcut.
      if ((e.key === "Enter" || e.key === " ") && (e.target as HTMLElement | null)?.closest?.("button")) {
        return;
      }

      const pending = pendingRef.current;
      if (pending) {
        const row = flatRows.find((r) => r.rowKey === pending.row);
        const chord = row?.chords[pending.step];
        if (row && chord && (chordMatchesEvent(chord, e) || chordMatchesEvent(chord, e, true))) {
          e.preventDefault();
          e.stopPropagation();
          flashStep(row.rowKey, pending.step);
          clearTimeout(pendingTimer.current);
          pendingRef.current =
            pending.step + 1 < row.chords.length ? { row: row.rowKey, step: pending.step + 1 } : null;
          if (pendingRef.current) {
            pendingTimer.current = window.setTimeout(() => {
              pendingRef.current = null;
            }, SEQUENCE_WINDOW_MS);
          }
          return;
        }
        pendingRef.current = null;
        clearTimeout(pendingTimer.current);
      }

      // exact pass first, lenient (Shift folded into the character) second
      const hit =
        flatRows.find((r) => r.chords[0] && chordMatchesEvent(r.chords[0], e)) ??
        flatRows.find((r) => r.chords[0] && chordMatchesEvent(r.chords[0], e, true));
      if (!hit) return;

      e.preventDefault();
      e.stopPropagation();
      flashStep(hit.rowKey, 0);
      if (hit.chords.length > 1) {
        pendingRef.current = { row: hit.rowKey, step: 1 };
        clearTimeout(pendingTimer.current);
        pendingTimer.current = window.setTimeout(() => {
          pendingRef.current = null;
        }, SEQUENCE_WINDOW_MS);
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [isOpen, liveEcho, flatRows, flashStep]);

  // Closing must not leave a half-played rehearsal to resume on reopen.
  useEffect(() => {
    if (isOpen) return;
    clearFlashTimers();
    clearTimeout(pendingTimer.current);
    pendingRef.current = null;
    setFlash(null);
  }, [isOpen, clearFlashTimers]);

  useEffect(
    () => () => {
      flashTimers.current.forEach(clearTimeout);
      flashTimers.current = [];
      clearTimeout(pendingTimer.current);
      clearTimeout(closingRef.current);
    },
    []
  );

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={`ns-qk m-auto w-[min(40rem,calc(100vw-2rem))] overflow-visible p-0 ${className}`}
    >
      {/* showModal() focuses the first focusable descendant unless something
          claims it. Left alone that pre-selects the first shortcut row and
          paints a focus ring on it at rest — take it here so focus lands in
          the panel, the title is announced, and Tab starts at the top. */}
      <div autoFocus tabIndex={-1} className="ns-qk-panel">
        <header className="flex items-baseline justify-between gap-4 px-6 pb-4 pt-5">
          <h2 id={titleId} className="text-base font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <p className="shrink-0 text-xs text-muted">Press a shortcut to try it</p>
        </header>

        <div
          className={`grid gap-x-8 gap-y-6 px-6 pb-2 ${columns === 2 ? "sm:grid-cols-2" : "grid-cols-1"}`}
        >
          {rows.map((section, s) => (
            <section key={`${section.title}-${s}`} aria-labelledby={`${titleId}-s${s}`}>
              <h3
                id={`${titleId}-s${s}`}
                className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted"
              >
                {section.title}
              </h3>
              <ul className="flex flex-col gap-0.5">
                {section.items.map((item) => (
                  <li key={item.rowKey}>
                    <button
                      type="button"
                      data-rehearse
                      onClick={() => rehearse(item.rowKey, item.chords.length)}
                      aria-label={`${item.label}: ${spokenKeys(item.chords, isApple)}`}
                      className="ns-qk-row"
                    >
                      <span aria-hidden className="min-w-0 truncate text-[13px] text-foreground">
                        {item.label}
                      </span>
                      <span aria-hidden className="flex shrink-0 items-center gap-1">
                        {item.chords.map((chord, step) => (
                          <span key={step} className="flex items-center gap-1">
                            {step > 0 && <span className="ns-qk-then">then</span>}
                            {chord.tokens.map((token, t) => (
                              <kbd
                                key={t}
                                className="ns-qk-cap"
                                data-pressed={flash === `${item.rowKey}:${step}` ? "" : undefined}
                              >
                                {displayToken(token, isApple)}
                              </kbd>
                            ))}
                          </span>
                        ))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="mt-2 flex items-center justify-between gap-4 border-t border-border px-6 py-3">
          <p className="flex items-center gap-2 text-xs text-muted">
            <kbd className="ns-qk-cap" aria-hidden>
              Esc
            </kbd>
            to close
          </p>
          <button type="button" onClick={requestClose} className="ns-qk-close">
            Close
          </button>
        </footer>
      </div>

      {/* ::backdrop inherits custom properties from its originating element,
          so the scrim stays token-derived in both themes. */}
      <style>{`
        .ns-qk {
          border: 1px solid var(--border);
          border-radius: 16px;
          background: var(--surface);
          color: var(--foreground);
          box-shadow: 0 24px 60px -20px color-mix(in oklab, var(--foreground) 30%, transparent);
          animation: ns-qk-panel-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .ns-qk[data-closing] { animation: ns-qk-panel-out 150ms ease-in both; }
        .ns-qk::backdrop {
          background: color-mix(in oklab, var(--background) 72%, transparent);
          backdrop-filter: blur(2px);
          animation: ns-qk-scrim-in 120ms linear both;
        }
        .ns-qk[data-closing]::backdrop { animation: ns-qk-scrim-out 150ms linear both; }
        .ns-qk-panel { outline: none; }

        @keyframes ns-qk-panel-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: none; }
        }
        @keyframes ns-qk-panel-out {
          from { opacity: 1; transform: none; }
          to { opacity: 0; transform: translateY(4px) scale(0.99); }
        }
        @keyframes ns-qk-scrim-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes ns-qk-scrim-out { from { opacity: 1 } to { opacity: 0 } }

        .ns-qk-row {
          display: flex;
          width: 100%;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 5px 8px;
          border: 1px solid transparent;
          border-radius: 6px;
          background: transparent;
          text-align: left;
          transition: background-color 140ms ease-out, border-color 140ms ease-out;
        }
        .ns-qk-row:hover {
          background: color-mix(in oklab, var(--foreground) 6%, transparent);
          border-color: var(--border);
        }
        .ns-qk-row:active {
          background: color-mix(in oklab, var(--accent) 12%, transparent);
          border-color: color-mix(in oklab, var(--accent) 45%, var(--border));
        }
        .ns-qk-row:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        .ns-qk-then {
          font-size: 11px;
          color: var(--muted);
          padding: 0 2px;
        }

        .ns-qk-cap {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 26px;
          height: 26px;
          padding: 0 7px;
          border: 1px solid var(--border);
          border-radius: 6px;
          /* the panel is --surface, so caps sit on --background to read as a
             separate physical object in both themes */
          background: var(--background);
          box-shadow: 0 2px 0 var(--border);
          color: var(--foreground);
          font: 500 12px/1 var(--font-mono, ui-monospace, monospace);
          white-space: nowrap;
          /* release: slow settle back up */
          transition: transform 140ms cubic-bezier(0.22, 1, 0.36, 1),
            box-shadow 140ms cubic-bezier(0.22, 1, 0.36, 1),
            background-color 200ms ease-out, border-color 200ms ease-out, color 200ms ease-out;
        }
        .ns-qk-cap[data-pressed] {
          transform: translateY(2px);
          box-shadow: 0 0 0 var(--border);
          border-color: var(--accent);
          background: color-mix(in oklab, var(--accent) 14%, var(--surface));
          color: var(--accent);
          /* press-in: immediate */
          transition: transform 60ms linear, box-shadow 60ms linear,
            background-color 60ms linear, border-color 60ms linear, color 60ms linear;
        }

        .ns-qk-close {
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--background);
          color: var(--foreground);
          font-size: 12px;
          padding: 4px 12px;
          transition: background-color 140ms ease-out, border-color 140ms ease-out;
        }
        .ns-qk-close:hover {
          border-color: var(--accent);
          background: color-mix(in oklab, var(--accent) 10%, var(--background));
        }
        .ns-qk-close:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

        @media (prefers-reduced-motion: reduce) {
          /* opacity only, one frame; the flash drops travel and becomes a pure
             colour change — still a real pixel change, so headless
             hover/keydown verification keeps working */
          .ns-qk, .ns-qk[data-closing] {
            animation-duration: 1ms;
            animation-timing-function: linear;
          }
          @keyframes ns-qk-panel-in { from { opacity: 0 } to { opacity: 1 } }
          @keyframes ns-qk-panel-out { from { opacity: 1 } to { opacity: 0 } }
          .ns-qk-cap, .ns-qk-cap[data-pressed] {
            transform: none;
            box-shadow: 0 2px 0 var(--border);
            transition: background-color 200ms ease-out, border-color 200ms ease-out,
              color 200ms ease-out;
          }
        }
      `}</style>
    </dialog>
  );
}
