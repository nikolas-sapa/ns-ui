"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

// ---------------------------------------------------------------------------
// StencilFill — a reusable pattern-masked input. The full template is
// visible at rest as a muted stencil (e.g. "XXXX-XXXX-XXXX", literal
// separators already in place); each typed character inks its own cell from
// --ns-muted to --foreground. One native <input> (transparent text/caret,
// positioned exactly over the decorative glyph grid — the same "real control
// drives, decorative layer displays" split as card-number-emboss) owns
// focus, value, label and autocomplete semantics, so the emitted value keeps
// its separators. A rejected character prints in its own cell at 40% muted,
// shakes on a spring, then falls away — the signature "show what was
// refused" beat — while aria-describedby states the format contract before
// the first keystroke, rather than auto-inserting separators as you type.
//
// This is the reusable MASK MECHANISM (license keys, IBANs, phone numbers,
// ticket IDs — any 'X'-templated string), not a format-specific treatment:
// card-number-emboss embosses one fixed payment layout, this stencils
// whatever mask you hand it.
// ---------------------------------------------------------------------------

export interface StencilFillProps {
  /** Template string: 'X' = editable cell, any other character = literal separator (auto-skipped, never typed). */
  mask: string;
  /** Accessible name for the underlying input. */
  label: string;
  /** Overrides the auto-derived aria-describedby copy. */
  formatDescription?: string;
  /** Per-character acceptance check. Defaults to A-Z / 0-9. */
  validate?: (char: string) => boolean;
  /** Normalizes an accepted character before it's inked. Defaults to uppercase. */
  transform?: (char: string) => string;
  /** Builds the polite live-region message for a refused character. */
  rejectMessage?: (char: string) => string;
  name?: string;
  autoComplete?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

interface MaskToken {
  kind: "slot" | "sep";
  char: string;
}

function parseMask(mask: string): MaskToken[] {
  return mask.split("").map((char) => (char === "X" ? { kind: "slot", char } : { kind: "sep", char }));
}

function deriveFormatDescription(mask: string): string {
  const groups = mask.match(/X+/g) ?? [];
  const seps = Array.from(new Set(mask.replace(/X/g, "").split("").filter(Boolean)));
  const firstGroupLen = groups[0]?.length ?? 0;
  if (groups.length > 1 && groups.every((g) => g.length === firstGroupLen) && seps.length === 1) {
    return `Format: ${groups.length} groups of ${firstGroupLen} characters, separated by ${seps[0]}`;
  }
  if (groups.length === 1 && seps.length === 0) {
    return `Format: ${firstGroupLen} characters`;
  }
  return `Format: ${mask}`;
}

function defaultValidate(char: string): boolean {
  return /^[A-Za-z0-9]$/.test(char);
}

function defaultTransform(char: string): string {
  return char.toUpperCase();
}

function defaultRejectMessage(char: string): string {
  return /^[a-zA-Z]$/.test(char) ? `Letter ${char.toUpperCase()} not allowed` : `Character "${char}" not allowed`;
}

function buildValue(tokens: MaskToken[], typed: string[]): string {
  let out = "";
  let i = 0;
  for (const t of tokens) {
    if (t.kind === "slot") {
      if (i >= typed.length) break;
      out += typed[i];
      i += 1;
    } else {
      if (i === 0) break;
      out += t.char;
    }
  }
  return out;
}

let rejectSeq = 0;

export function StencilFill({
  mask,
  label,
  formatDescription,
  validate = defaultValidate,
  transform = defaultTransform,
  rejectMessage = defaultRejectMessage,
  name,
  autoComplete = "off",
  defaultValue = "",
  onValueChange,
  className = "",
}: StencilFillProps) {
  const autoId = useId().replace(/:/g, "");
  const tokens = useMemo(() => parseMask(mask), [mask]);
  const totalSlots = useMemo(() => tokens.filter((t) => t.kind === "slot").length, [tokens]);
  const separatorChars = useMemo(
    () => new Set(tokens.filter((t) => t.kind === "sep").map((t) => t.char)),
    [tokens],
  );
  const description = formatDescription ?? deriveFormatDescription(mask);

  const [typed, setTyped] = useState<string[]>(() => {
    const chars: string[] = [];
    for (const ch of defaultValue) {
      if (chars.length >= totalSlots) break;
      if (/[A-Za-z0-9]/.test(ch)) chars.push(ch.toUpperCase());
    }
    return chars;
  });
  const [focused, setFocused] = useState(false);
  // Mirrors `focused` for the caret's visibility so the caret still shows up
  // under autoplay: the demo subtree is `inert` there, and `inert` elements
  // are not focusable, so the driver's synthetic keydowns never produce a
  // real `focus` event even though they do drive typing. Set on any handled
  // key/paste, cleared on blur — under real interaction it always coincides
  // with `focused`, so behavior for a real user is unchanged.
  const [armed, setArmed] = useState(false);
  const [rejected, setRejected] = useState<{ slot: number; char: string; id: number } | null>(null);
  const [announce, setAnnounce] = useState("");

  const typedRef = useRef(typed);
  typedRef.current = typed;
  const reducedRef = useRef(false);
  const rejectFallbackRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cascadeTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(
    () => () => {
      clearTimeout(rejectFallbackRef.current);
      clearTimeout(announceTimerRef.current);
      cascadeTimersRef.current.forEach(clearTimeout);
    },
    [],
  );

  const commitTyped = useCallback(
    (next: string[]) => {
      setTyped(next);
      onValueChange?.(buildValue(tokens, next));
    },
    [tokens, onValueChange],
  );

  const say = useCallback((msg: string) => {
    clearTimeout(announceTimerRef.current);
    setAnnounce("");
    announceTimerRef.current = setTimeout(() => setAnnounce(msg), 30);
  }, []);

  const triggerReject = useCallback(
    (slot: number, char: string) => {
      clearTimeout(rejectFallbackRef.current);
      rejectSeq += 1;
      const id = rejectSeq;
      setRejected({ slot, char, id });
      say(rejectMessage(char));
      rejectFallbackRef.current = setTimeout(() => {
        setRejected((r) => (r?.id === id ? null : r));
      }, 900);
    },
    [rejectMessage, say],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        setArmed(true);
        clearTimeout(rejectFallbackRef.current);
        setRejected(null);
        if (typedRef.current.length) commitTyped(typedRef.current.slice(0, -1));
        return;
      }

      if (e.key.length !== 1) return; // let Tab, Enter, arrows, Escape through natively
      e.preventDefault();
      setArmed(true);

      if (separatorChars.has(e.key)) return; // literal separator: auto-skipped, not a rejection
      if (typedRef.current.length >= totalSlots) return; // full: no-op, not a rejection

      if (validate(e.key)) {
        clearTimeout(rejectFallbackRef.current);
        setRejected(null);
        commitTyped([...typedRef.current, transform(e.key)]);
      } else {
        triggerReject(typedRef.current.length, e.key);
      }
    },
    [commitTyped, separatorChars, totalSlots, transform, triggerReject, validate],
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      setArmed(true);
      const text = e.clipboardData.getData("text");
      const accepted: string[] = [];
      for (const ch of text) {
        if (typedRef.current.length + accepted.length >= totalSlots) break;
        if (separatorChars.has(ch)) continue;
        if (validate(ch)) accepted.push(transform(ch));
      }
      if (!accepted.length) return;

      cascadeTimersRef.current.forEach(clearTimeout);
      cascadeTimersRef.current = [];
      const step = reducedRef.current ? 0 : 45;
      accepted.forEach((ch, i) => {
        const timer = setTimeout(() => {
          if (typedRef.current.length >= totalSlots) return;
          commitTyped([...typedRef.current, ch]);
        }, step * i);
        cascadeTimersRef.current.push(timer);
      });
    },
    [commitTyped, separatorChars, totalSlots, transform, validate],
  );

  // Safety net for paths that never fire our own keydown handler — IME
  // composition landing its result, browser autofill, drag-and-drop text,
  // or a mobile virtual keyboard that reports `key: "Unidentified"` — all of
  // which still produce a real `input`/`change` event. Every ordinary
  // keystroke is already `preventDefault()`-ed above, so the DOM input's
  // displayed value never actually changes on that path and this handler is
  // a no-op for it; it only ever runs for value writes we didn't intercept.
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const next: string[] = [];
      for (const ch of e.target.value) {
        if (next.length >= totalSlots) break;
        if (separatorChars.has(ch)) continue;
        if (validate(ch)) next.push(transform(ch));
      }
      const prev = typedRef.current;
      if (next.length === prev.length && next.every((c, i) => c === prev[i])) return;
      commitTyped(next);
    },
    [commitTyped, separatorChars, totalSlots, transform, validate],
  );

  const value = useMemo(() => buildValue(tokens, typed), [tokens, typed]);
  const describedById = `sf-desc-${autoId}`;
  const inputId = `sf-input-${autoId}`;

  let slotIndex = -1;

  return (
    <div className={`relative inline-block ${className}`}>
      <style>{CSS}</style>
      <span id={describedById} className="sr-only">
        {description}
      </span>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </span>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>

      <div
        className="relative inline-flex h-[2.7em] items-center rounded-[0.67em] border border-border bg-background px-[0.67em]"
        style={{ fontSize: "var(--sf-size, 1.125rem)" }}
      >
        <input
          id={inputId}
          name={name}
          type="text"
          inputMode="text"
          autoComplete={autoComplete}
          autoCapitalize="characters"
          spellCheck={false}
          aria-describedby={describedById}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setArmed(false);
          }}
          className="ns-sf-input absolute inset-0 z-10 h-full w-full rounded-[12px]"
        />
        <div
          aria-hidden="true"
          data-sf-glyphs
          className="pointer-events-none flex items-center font-mono"
        >
          {tokens.map((t, i) => {
            if (t.kind === "sep") {
              return (
                <span key={i} className="ns-sf-cell ns-sf-sep">
                  {t.char}
                </span>
              );
            }
            slotIndex += 1;
            const mySlot = slotIndex;
            const filled = mySlot < typed.length;
            const isNextOpen = mySlot === typed.length;
            const isRejected = rejected?.slot === mySlot;
            return (
              <span key={i} className="ns-sf-cell relative inline-flex items-center justify-center">
                {(focused || armed) && isNextOpen && !isRejected && (
                  <span aria-hidden="true" className="ns-sf-caret" />
                )}
                <span className={`ns-sf-glyph ${filled ? "ns-sf-ink" : "ns-sf-stencil"}`}>
                  {filled ? typed[mySlot] : "X"}
                </span>
                {isRejected && rejected && (
                  <span
                    key={rejected.id}
                    aria-hidden="true"
                    className="ns-sf-reject"
                    onAnimationEnd={() => setRejected((r) => (r?.id === rejected.id ? null : r))}
                  >
                    {rejected.char}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const CSS = `
.ns-sf-input{ background: transparent; color: transparent; caret-color: transparent; border: none; padding: 0; font: inherit; outline: none; border-radius: inherit; transition: box-shadow 150ms ease-out; }
.ns-sf-input:hover{ box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--border), var(--foreground) 35%); }
.ns-sf-input:focus-visible{ outline: 0.11em solid var(--ns-accent); outline-offset: 0.11em; box-shadow: none; }
.ns-sf-cell{ display: inline-flex; align-items: center; justify-content: center; width: 1.2ch; text-align: center; }
.ns-sf-glyph{ display: inline-block; min-width: 1ch; transition: color 90ms ease-out, opacity 90ms ease-out, font-weight 90ms ease-out; }
.ns-sf-stencil{ color: var(--ns-muted); opacity: 0.62; font-weight: 400; }
.ns-sf-ink{ color: var(--foreground); opacity: 1; font-weight: 600; }
.ns-sf-sep{ color: var(--ns-muted); opacity: 0.62; }
.ns-sf-caret{ position: absolute; left: -1px; top: 50%; width: 0.11em; height: 1.15em; transform: translateY(-50%); background: var(--ns-accent); border-radius: 1px; animation: ns-sf-blink 1s steps(1, jump-none) infinite; }
.ns-sf-reject{ position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--ns-muted); font-weight: 500; pointer-events: none; animation: ns-sf-reject-spring 560ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
@keyframes ns-sf-blink{ 0%, 49%{ opacity: 1; } 50%, 100%{ opacity: 0; } }
@keyframes ns-sf-reject-spring{
  0%{ opacity: 0; transform: translate(0, 0); }
  10%{ opacity: 0.4; transform: translate(0, 0); }
  28%{ opacity: 0.4; transform: translate(-3px, 0); }
  42%{ opacity: 0.4; transform: translate(2.4px, 0); }
  56%{ opacity: 0.4; transform: translate(-1.6px, 0); }
  70%{ opacity: 0.4; transform: translate(0.8px, 0); }
  82%{ opacity: 0.4; transform: translate(0, 0); }
  100%{ opacity: 0; transform: translate(0, 7px); }
}
@media (prefers-reduced-motion: reduce){
  .ns-sf-caret{ animation: none; opacity: 1; }
  .ns-sf-reject{ animation: ns-sf-reject-fade 260ms ease-out forwards; }
  .ns-sf-glyph{ transition: color 60ms linear, opacity 60ms linear; }
}
@keyframes ns-sf-reject-fade{
  0%{ opacity: 0; }
  30%{ opacity: 0.4; }
  100%{ opacity: 0; }
}
`;

export default StencilFill;
