"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

// A single-choice input rendered as a paper ballot. Each option is a real
// role="radio" button (roving tabindex, arrow-key navigation — the standard
// WAI-ARIA radiogroup pattern) styled as a paper slip; hovering an unselected
// slip lifts its corner. Selecting one spawns a decorative ghost clone that
// folds, flutters, and rises through the ballot box's slot before fading —
// changing the vote also retracts the previous ghost back out. The real
// option element never leaves the DOM (it just switches to its "chosen"
// ink), so the control stays a fully functional, always-focusable radio
// group; the paper-drop animation is a one-shot CSS keyframe flourish, not a
// per-frame rAF simulation.

export type BallotOption = { value: string; label: string };

const DEFAULT_OPTIONS: BallotOption[] = [
  { value: "lisbon", label: "Lisbon" },
  { value: "kyoto", label: "Kyoto" },
  { value: "reykjavik", label: "Reykjavik" },
];

type Ghost = {
  id: number;
  label: string;
  top: number;
  left: number;
  width: number;
  height: number;
  travel: number;
  mode: "drop" | "retract";
};

let ghostSeq = 0;

export function BallotDrop({
  options = DEFAULT_OPTIONS,
  label = "Offsite location",
  defaultValue,
  className = "",
}: {
  options?: BallotOption[];
  label?: string;
  defaultValue?: string;
  className?: string;
}) {
  const reactId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [selected, setSelected] = useState<string | undefined>(defaultValue);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const liveRef = useRef<HTMLDivElement>(null);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const announce = useCallback((text: string) => {
    if (liveRef.current) liveRef.current.textContent = text;
  }, []);

  const spawnGhost = useCallback((optionEl: HTMLButtonElement, mode: Ghost["mode"]) => {
    const wrap = wrapRef.current;
    const box = boxRef.current;
    if (!wrap || !box) return;
    const wrapRect = wrap.getBoundingClientRect();
    const optRect = optionEl.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    const top = optRect.top - wrapRect.top;
    const left = optRect.left - wrapRect.left;
    const travel = boxRect.bottom - optRect.top - optRect.height * 0.3;
    const id = ++ghostSeq;
    setGhosts((g) => [
      ...g,
      {
        id,
        label: optionEl.textContent ?? "",
        top,
        left,
        width: optRect.width,
        height: optRect.height,
        travel: -travel,
        mode,
      },
    ]);
    return id;
  }, []);

  const removeGhost = (id: number) => setGhosts((g) => g.filter((x) => x.id !== id));

  const choose = useCallback(
    (value: string) => {
      if (value === selected) return;
      const prevValue = selected;
      const el = optionRefs.current[value];
      setSelected(value);
      const opt = options.find((o) => o.value === value);
      announce(prevValue ? `Vote changed to ${opt?.label}` : `Voted: ${opt?.label}`);
      if (el) spawnGhost(el, "drop");
      if (prevValue) {
        const prevEl = optionRefs.current[prevValue];
        if (prevEl) spawnGhost(prevEl, "retract");
      }
    },
    [selected, options, announce, spawnGhost]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = options.findIndex((o) => o.value === (selected ?? options[0]?.value));
    let next = -1;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + options.length) % options.length;
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    else return;
    e.preventDefault();
    const target = options[next];
    if (target) {
      choose(target.value);
      optionRefs.current[target.value]?.focus();
    }
  };

  return (
    <div ref={wrapRef} className={`relative flex w-64 flex-col items-center ${className}`}>
      <style>{`
        @keyframes nsui-ballot-drop {
          0% { transform: translateY(0) rotate(0deg) scaleY(1); opacity: 1; }
          18% { transform: translateY(calc(var(--nsui-travel) * 0.12)) rotate(-7deg) scaleY(0.9); opacity: 1; }
          40% { transform: translateY(calc(var(--nsui-travel) * 0.55)) rotate(6deg) scaleY(0.82); opacity: 1; }
          62% { transform: translateY(calc(var(--nsui-travel) * 0.85)) rotate(-4deg) scaleY(0.78); opacity: 0.85; }
          100% { transform: translateY(var(--nsui-travel)) rotate(2deg) scaleY(0.72); opacity: 0; }
        }
        @keyframes nsui-ballot-retract {
          0% { transform: translateY(var(--nsui-travel)) rotate(2deg) scaleY(0.72); opacity: 0; }
          20% { transform: translateY(calc(var(--nsui-travel) * 0.7)) rotate(-5deg) scaleY(0.8); opacity: 0.7; }
          55% { transform: translateY(calc(var(--nsui-travel) * 0.25)) rotate(4deg) scaleY(0.9); opacity: 0.6; }
          100% { transform: translateY(0) rotate(0deg) scaleY(1); opacity: 0; }
        }
        @keyframes nsui-ballot-drop-reduced {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(calc(var(--nsui-travel) * 0.4)); opacity: 0; }
        }
        @keyframes nsui-ballot-retract-reduced {
          0% { transform: translateY(calc(var(--nsui-travel) * 0.4)); opacity: 0; }
          100% { transform: translateY(0); opacity: 0; }
        }
      `}</style>

      {/* the ballot box: hairline body with a slot notch facing the options below it */}
      <div
        ref={boxRef}
        aria-hidden="true"
        className="relative z-10 h-14 w-44 rounded-t-[12px] border border-border bg-surface"
      >
        <div className="absolute inset-x-0 -bottom-px flex justify-center">
          <div className="h-[3px] w-20 rounded-full border border-border bg-background" />
        </div>
      </div>

      {/* ghost overlay: decorative paper-drop clones, never focusable */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 overflow-visible">
        {ghosts.map((g) => (
          <div
            key={g.id}
            onAnimationEnd={() => removeGhost(g.id)}
            className="absolute rounded-[4px] border border-border bg-[#f4f2ec] shadow-[0_4px_10px_-4px_rgba(0,0,0,0.35)]"
            style={
              {
                top: g.top,
                left: g.left,
                width: g.width,
                height: g.height,
                "--nsui-travel": `${g.travel}px`,
                animation: `${
                  reducedRef.current
                    ? g.mode === "drop"
                      ? "nsui-ballot-drop-reduced"
                      : "nsui-ballot-retract-reduced"
                    : g.mode === "drop"
                      ? "nsui-ballot-drop"
                      : "nsui-ballot-retract"
                } ${reducedRef.current ? 260 : 620}ms cubic-bezier(0.3,0.6,0.3,1) forwards`,
              } as React.CSSProperties
            }
          >
            <span className="flex h-full items-center justify-center px-2 font-mono text-[11px] text-[#171717]">
              {g.label}
            </span>
          </div>
        ))}
      </div>

      <div
        role="radiogroup"
        aria-label={label}
        aria-describedby={`${reactId}-hint`}
        onKeyDown={onKeyDown}
        className="mt-6 flex w-full flex-col gap-2.5"
      >
        {options.map((opt) => {
          const checked = opt.value === selected;
          return (
            <button
              key={opt.value}
              ref={(el) => {
                optionRefs.current[opt.value] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked || (!selected && opt.value === options[0]?.value) ? 0 : -1}
              onClick={() => choose(opt.value)}
              className="group relative overflow-visible rounded-[6px] border border-border bg-[#f4f2ec] px-4 py-3 text-left outline-none transition-[transform,box-shadow] duration-150 ease-out motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {/* peeling corner: lifts on hover of an unselected slip */}
              <span
                aria-hidden="true"
                className="absolute right-0 top-0 h-4 w-4 origin-top-right rounded-bl-[6px] bg-[#e7e3d8] shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:rotate-[8deg] motion-reduce:transition-none"
                style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }}
              />
              <span className="flex items-center justify-between gap-3">
                <span className="font-mono text-sm text-[#171717]">{opt.label}</span>
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full border border-[#171717]/40 transition-colors ${
                    checked ? "bg-[#171717]" : "bg-transparent"
                  }`}
                />
              </span>
            </button>
          );
        })}
      </div>

      <div ref={liveRef} aria-live="polite" aria-atomic="true" className="sr-only" />
      <p className="sr-only" id={`${reactId}-hint`}>
        Use arrow keys to change your vote.
      </p>
    </div>
  );
}
