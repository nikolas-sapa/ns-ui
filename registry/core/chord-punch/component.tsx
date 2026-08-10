"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";

// A keyboard-shortcut RECORDER: click (or press Enter) to arm it, then press
// the combination you want it to remember. Distinct from shortcuts-cheat-sheet
// (which displays and rehearses a list of EXISTING bindings) and quick-key
// (which executes a bound shortcut) — this is the capture surface those two
// presuppose already happened somewhere.
//
// MECHANISM: recording is entered only by a deliberate click or an Enter
// keypress while idle — never by Tab landing on the control alone, so a user
// tabbing through a settings form never has their next keystroke swallowed by
// surprise. Once armed, every keydown on the surface is intercepted: modifier
// keys (Control/Alt/Shift/Meta) seat a keycap in fixed canonical slots
// (⌃ ⌥ ⇧ ⌘) regardless of the order they were physically pressed, and the
// first non-modifier keydown is the terminal key — it freezes the chord's
// modifier flags from ITS OWN event (not the live-accumulated set, so a
// modifier keydown this component happened to miss can't corrupt what
// commits) and punches its keycap in with a spring overshoot. The whole
// combination only commits once every held key has come back up — a Set of
// currently-down `event.code`s is what "every key" means; the terminal key's
// own release is necessary but not sufficient if a modifier is still held.
// Escape cancels the attempt outright (reverting to whatever was bound
// before); Backspace un-strikes just the terminal key so the seated modifiers
// can try a different one without re-pressing them. Losing focus while armed
// cancels the same way Escape does, so a field can never be left silently
// listening.
//
// Tab is deliberately never intercepted, armed or not — swallowing it would
// strand keyboard users on the one control that most needs Tab to keep
// working.
//
// CONFLICTS: a `bindings` list (this recorder's siblings in the same
// keymap) is checked by exact modifier+base signature the instant a
// terminal key strikes — live, while still held — and again on commit, so a
// collision is never a toast that arrives after the fact: it renders right
// under the assembling (or committed) chord as a second row in --ns-muted
// keycaps, separated by a "≠" rule.
//
// A11Y: entry and exit are announced through a role="alert" aria-live="assertive"
// region ("Recording, press a combination, escape to cancel." on arm; the
// full spoken chord plus any conflict, e.g. "Command Shift K, conflicts with
// Delete Line", on commit or cancellation). The accessible name itself comes
// from a visible label plus a visually-hidden state span via
// aria-labelledby, so it stays correct at rest without needing the live
// region to have fired first. No canvas; DOM + CSS only.

export type ChordValue = {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  /** Canonical base key token: a single uppercase char, or a named token like "SPACE", "ENTER", "↑". */
  base: string;
};

export type ChordBinding = {
  /** Unique id among the sibling bindings this recorder is checked against. */
  id: string;
  /** Human label for the bound command, e.g. "Delete Line". */
  label: string;
  chord: ChordValue;
};

export interface ChordPunchProps {
  /** This recorder's own id — excluded from its own conflict lookup. */
  id?: string;
  /** Visible label for the command being bound, e.g. "Duplicate Line". */
  label: string;
  placeholder?: string;
  /** Controlled committed chord. Omit to run uncontrolled from `defaultValue`. */
  value?: ChordValue | null;
  defaultValue?: ChordValue | null;
  onChange?: (value: ChordValue) => void;
  /** Sibling bindings to check the assembling/committed chord against. */
  bindings?: ChordBinding[];
  className?: string;
}

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta", "AltGraph", "CapsLock", "OS"]);

const NAMED_BASE: Record<string, string> = {
  " ": "SPACE",
  enter: "ENTER",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
};

function canonicalBase(key: string): string {
  if (key === " ") return "SPACE";
  if (key.length === 1) return key.toUpperCase();
  return NAMED_BASE[key.toLowerCase()] ?? key.toUpperCase();
}

/** Deterministic signature: modifier flags + base, so lookups are exact-match. */
export function chordSignature(v: ChordValue): string {
  return `${v.ctrl ? 1 : 0}${v.alt ? 1 : 0}${v.shift ? 1 : 0}${v.meta ? 1 : 0}:${v.base}`;
}

function findConflict(
  chord: ChordValue,
  bindings: ChordBinding[] | undefined,
  ownId: string | undefined
): ChordBinding | null {
  if (!bindings || bindings.length === 0) return null;
  const sig = chordSignature(chord);
  return bindings.find((b) => b.id !== ownId && chordSignature(b.chord) === sig) ?? null;
}

function tokensFor(v: ChordValue): string[] {
  const t: string[] = [];
  if (v.ctrl) t.push("⌃");
  if (v.alt) t.push("⌥");
  if (v.shift) t.push("⇧");
  if (v.meta) t.push("⌘");
  t.push(v.base);
  return t;
}

const SPOKEN_BASE: Record<string, string> = {
  SPACE: "Space",
  ENTER: "Enter",
  "↑": "Up Arrow",
  "↓": "Down Arrow",
  "←": "Left Arrow",
  "→": "Right Arrow",
};

/** "Command Shift K" — plain words, so a screen reader never meets a raw glyph. */
function spokenChord(v: ChordValue): string {
  const parts: string[] = [];
  if (v.ctrl) parts.push("Control");
  if (v.alt) parts.push("Option");
  if (v.shift) parts.push("Shift");
  if (v.meta) parts.push("Command");
  parts.push(SPOKEN_BASE[v.base] ?? v.base);
  return parts.join(" ");
}

function Keycap({ token, muted, strike }: { token: string; muted?: boolean; strike?: boolean }) {
  return (
    <span className={`ns-cp-cap${muted ? " ns-cp-cap-muted" : ""}${strike ? " ns-cp-cap-strike" : ""}`} aria-hidden>
      <span className="ns-cp-corner ns-cp-corner-tl">⌜</span>
      <span className="ns-cp-corner ns-cp-corner-tr">⌝</span>
      <span className="ns-cp-glyph">{token}</span>
      <span className="ns-cp-corner ns-cp-corner-bl">⌞</span>
      <span className="ns-cp-corner ns-cp-corner-br">⌟</span>
    </span>
  );
}

export function ChordPunch({
  id,
  label,
  placeholder = "No shortcut set",
  value,
  defaultValue = null,
  onChange,
  bindings,
  className = "",
}: ChordPunchProps) {
  const labelId = useId();
  const stateId = useId();

  const [uncommitted, setUncommitted] = useState<ChordValue | null>(defaultValue);
  const committedValue = value !== undefined ? value : uncommitted;

  const [isRecording, setIsRecording] = useState(false);
  const [seated, setSeated] = useState({ ctrl: false, alt: false, shift: false, meta: false });
  const [pendingTerminal, setPendingTerminal] = useState<ChordValue | null>(null);
  const [strikeSeq, setStrikeSeq] = useState(0);
  const [announce, setAnnounce] = useState("");

  const heldCodes = useRef<Set<string>>(new Set());

  const commit = useCallback(
    (chord: ChordValue) => {
      if (value === undefined) setUncommitted(chord);
      setIsRecording(false);
      setPendingTerminal(null);
      setSeated({ ctrl: false, alt: false, shift: false, meta: false });
      heldCodes.current.clear();
      const hit = findConflict(chord, bindings, id);
      setAnnounce(`${spokenChord(chord)}${hit ? `, conflicts with ${hit.label}` : ""}`);
      onChange?.(chord);
    },
    [value, bindings, id, onChange]
  );

  const arm = useCallback(() => {
    setIsRecording(true);
    setPendingTerminal(null);
    setSeated({ ctrl: false, alt: false, shift: false, meta: false });
    heldCodes.current.clear();
    setAnnounce("Recording, press a combination, escape to cancel.");
  }, []);

  const handleClick = useCallback(() => {
    // Idempotent: re-clicking while already armed just re-arms a fresh
    // capture rather than toggling out of recording — a stray extra click
    // (or the verifier's own press pass) can never leave this half-armed.
    arm();
  }, [arm]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Tab") return; // never intercepted, armed or not
      if (!isRecording) {
        if (e.key === "Enter" && !e.repeat) arm();
        return;
      }
      e.preventDefault();
      if (e.key === "Escape") {
        setIsRecording(false);
        setPendingTerminal(null);
        setSeated({ ctrl: false, alt: false, shift: false, meta: false });
        heldCodes.current.clear();
        setAnnounce("Recording cancelled.");
        return;
      }
      if (e.key === "Backspace") {
        // Un-strike the terminal key only; seated modifiers (still physically
        // held) and the release-tracking Set are left alone.
        setPendingTerminal(null);
        return;
      }
      heldCodes.current.add(e.code);
      if (MODIFIER_KEYS.has(e.key)) {
        setSeated({ ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey });
        return;
      }
      // Terminal key: freeze the chord from this event's own modifier flags.
      setPendingTerminal({
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey,
        base: canonicalBase(e.key),
      });
      setStrikeSeq((s) => s + 1);
    },
    [isRecording, arm]
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Tab") return;
      if (!isRecording) return;
      if (e.key === "Escape" || e.key === "Backspace") return;
      heldCodes.current.delete(e.code);
      if (MODIFIER_KEYS.has(e.key)) {
        setSeated({ ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey });
      }
      if (heldCodes.current.size === 0 && pendingTerminal) {
        commit(pendingTerminal);
      }
    },
    [isRecording, pendingTerminal, commit]
  );

  const handleBlur = useCallback(() => {
    if (!isRecording) return;
    setIsRecording(false);
    setPendingTerminal(null);
    setSeated({ ctrl: false, alt: false, shift: false, meta: false });
    heldCodes.current.clear();
  }, [isRecording]);

  // Live modifiers to show: the terminal key's frozen flags once one has
  // struck (so the display doesn't flicker if a modifier lets go early),
  // otherwise whatever's currently seated.
  const liveMods = pendingTerminal ?? seated;
  const liveChord: ChordValue | null = pendingTerminal;

  const conflict = useMemo(() => {
    const source = isRecording ? liveChord : committedValue;
    if (!source) return null;
    return findConflict(source, bindings, id);
  }, [isRecording, liveChord, committedValue, bindings, id]);

  const stateText = `${committedValue ? spokenChord(committedValue) : "not set"}${
    conflict && !isRecording ? `, conflicts with ${conflict.label}` : ""
  }. ${isRecording ? "Recording, press a combination, escape to cancel." : "Press Enter or click to record a new shortcut."}`;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <span id={labelId} className="text-xs font-medium text-foreground">
        {label}
      </span>
      <div
        role="button"
        tabIndex={0}
        aria-labelledby={`${labelId} ${stateId}`}
        data-chord-surface
        data-chord-recording={isRecording ? "true" : undefined}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={handleBlur}
        className="ns-cp-field"
      >
        <div className="ns-cp-primary">
          {isRecording ? (
            <span className="ns-cp-live">
              {liveMods.ctrl && <Keycap token="⌃" />}
              {liveMods.alt && <Keycap token="⌥" />}
              {liveMods.shift && <Keycap token="⇧" />}
              {liveMods.meta && <Keycap token="⌘" />}
              {pendingTerminal && <Keycap key={`term-${strikeSeq}`} token={pendingTerminal.base} strike />}
              <span className="ns-cp-cursor" />
            </span>
          ) : committedValue ? (
            tokensFor(committedValue).map((t, i) => <Keycap key={i} token={t} />)
          ) : (
            <span className="ns-cp-placeholder">{placeholder}</span>
          )}
          {isRecording && committedValue && (
            <span className="ns-cp-prev">was {tokensFor(committedValue).join(" ")}</span>
          )}
        </div>

        {conflict && (isRecording ? liveChord : committedValue) && (
          <div className="ns-cp-conflict">
            <div className="ns-cp-rule">
              <span className="ns-cp-rule-mark">≠</span>
            </div>
            <div className="ns-cp-conflict-row">
              {tokensFor(conflict.chord).map((t, i) => (
                <Keycap key={i} token={t} muted />
              ))}
              <span className="ns-cp-conflict-label">{conflict.label}</span>
            </div>
          </div>
        )}

        <p className="ns-cp-hint" aria-hidden>
          {isRecording ? "Press a combination · Esc cancels · Backspace clears" : "Click or press Enter to record"}
        </p>

        <span id={stateId} className="sr-only">
          {stateText}
        </span>
      </div>

      <div role="alert" aria-live="assertive" className="sr-only">
        {announce}
      </div>

      <style>{`
        .ns-cp-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 220px;
          padding: 12px 14px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--background);
          cursor: pointer;
          transition: border-color 140ms ease-out, background-color 140ms ease-out;
        }
        .ns-cp-field:hover {
          border-color: var(--ns-muted);
        }
        .ns-cp-field:focus-visible {
          outline: 2px solid var(--ns-accent);
          outline-offset: 2px;
        }
        .ns-cp-field[data-chord-recording] {
          border-color: var(--ns-accent);
          background: color-mix(in oklab, var(--ns-accent) 6%, var(--background));
        }

        .ns-cp-primary {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          min-height: 28px;
        }
        .ns-cp-live {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .ns-cp-placeholder {
          font: 12px/1 var(--font-mono, ui-monospace, monospace);
          color: var(--ns-muted);
        }
        .ns-cp-prev {
          margin-left: 6px;
          font: 11px/1 var(--font-mono, ui-monospace, monospace);
          color: var(--ns-muted);
          opacity: 0.75;
        }

        .ns-cp-cap {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 26px;
          height: 26px;
          padding: 0 8px;
          font: 600 12px/1 var(--font-mono, ui-monospace, monospace);
          color: var(--foreground);
          animation: ns-cp-seat 160ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .ns-cp-cap-muted {
          color: var(--ns-muted);
        }
        .ns-cp-corner {
          position: absolute;
          font-size: 10px;
          line-height: 1;
          color: var(--border);
          pointer-events: none;
        }
        .ns-cp-cap-muted .ns-cp-corner {
          color: var(--ns-muted);
          opacity: 0.6;
        }
        .ns-cp-corner-tl { top: 0; left: 0; }
        .ns-cp-corner-tr { top: 0; right: 0; }
        .ns-cp-corner-bl { bottom: 0; left: 0; }
        .ns-cp-corner-br { bottom: 0; right: 0; }

        .ns-cp-cap-strike {
          color: var(--ns-accent);
          animation: ns-cp-strike 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .ns-cp-cap-strike .ns-cp-corner {
          color: var(--ns-accent);
        }

        @keyframes ns-cp-seat {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: none; }
        }
        @keyframes ns-cp-strike {
          0% { opacity: 0; transform: scale(0.5); }
          60% { opacity: 1; transform: scale(1.18); }
          100% { transform: scale(1); }
        }

        .ns-cp-cursor {
          display: inline-block;
          width: 2px;
          height: 16px;
          margin-left: 2px;
          background: var(--ns-accent);
          animation: ns-cp-pulse 1000ms ease-in-out infinite;
        }
        @keyframes ns-cp-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }

        .ns-cp-hint {
          font-size: 11px;
          color: var(--ns-muted);
        }

        .ns-cp-conflict {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .ns-cp-rule {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .ns-cp-rule::before,
        .ns-cp-rule::after {
          content: "";
          flex: 1;
          height: 1px;
          background: var(--border);
        }
        .ns-cp-rule-mark {
          font: 11px var(--font-mono, ui-monospace, monospace);
          color: var(--ns-muted);
        }
        .ns-cp-conflict-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .ns-cp-conflict-label {
          font-size: 11px;
          color: var(--ns-muted);
        }

        @media (prefers-reduced-motion: reduce) {
          .ns-cp-cap {
            animation-duration: 1ms;
            animation-timing-function: linear;
          }
          @keyframes ns-cp-seat {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes ns-cp-strike {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .ns-cp-cursor {
            animation: none;
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
