"use client";

import { useEffect, useRef, useState } from "react";

// Tag input as beads cinched onto a cord: committed tags thread onto a wire
// of short cord segments, each arriving with a cinch — a slide in from the
// input with one overshoot squeeze — while its knot draws on. Backspace on an
// empty input unravels the last bead (a drop-and-twist exit) before it leaves
// the cord. Duplicates don't re-thread; the existing bead shudders instead.
// Pure DOM+SVG+CSS keyframes; the only JS timers park exiting beads for the
// length of their unravel animation and are cleared on unmount.

export interface CinchBeadProps {
  defaultTags?: string[];
  placeholder?: string;
  /** accessible name for the text input */
  label?: string;
  maxTags?: number;
  onChange?: (tags: string[]) => void;
  className?: string;
}

function Knot() {
  return (
    <svg aria-hidden width={10} height={10} viewBox="0 0 10 10" className="shrink-0">
      <circle
        cx={5}
        cy={5}
        r={3.2}
        fill="none"
        stroke="var(--muted)"
        strokeWidth={1.5}
        pathLength={1}
        className="cinch-knot"
      />
    </svg>
  );
}

function Cord({ className = "" }: { className?: string }) {
  return <span aria-hidden className={["h-px shrink-0 bg-border", className].join(" ")} />;
}

export function CinchBead({
  defaultTags = [],
  placeholder = "Add a tag…",
  label = "Tags",
  maxTags = Infinity,
  onChange,
  className = "",
}: CinchBeadProps) {
  const [tags, setTags] = useState<string[]>(defaultTags);
  const [leaving, setLeaving] = useState<string[]>([]);
  const [shaking, setShaking] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const reduced = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  ).current;

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const park = (fn: () => void, ms: number) => {
    if (reduced) return fn();
    const t = setTimeout(() => {
      timersRef.current.delete(t);
      fn();
    }, ms);
    timersRef.current.add(t);
  };

  const commit = (raw: string) => {
    const tag = raw.trim();
    if (!tag) return;
    if (tags.includes(tag)) {
      // already threaded — shudder the existing bead instead
      setShaking(tag);
      park(() => setShaking(null), 300);
      setDraft("");
      return;
    }
    if (tags.length >= maxTags) return;
    const next = [...tags, tag];
    setTags(next);
    setDraft("");
    onChange?.(next);
  };

  const unravel = (tag: string) => {
    if (leaving.includes(tag)) return;
    setLeaving((l) => [...l, tag]);
    const drop = () => {
      setLeaving((l) => l.filter((t) => t !== tag));
      setTags((prev) => {
        const next = prev.filter((t) => t !== tag);
        onChange?.(next);
        return next;
      });
    };
    reduced ? drop() : park(drop, 240);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
      const last = [...tags].reverse().find((t) => !leaving.includes(t));
      if (last) unravel(last);
    }
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={[
        "flex w-full cursor-text flex-wrap items-center rounded-md border border-border bg-surface px-3 py-2.5",
        "transition-colors duration-150 focus-within:border-muted",
        className,
      ].join(" ")}
    >
      <style>{`
        @keyframes cinch-in {
          0% { opacity: 0; transform: translateX(18px) scaleX(1.1); }
          62% { opacity: 1; transform: translateX(-2px) scaleX(0.97); }
          100% { opacity: 1; transform: translateX(0) scaleX(1); }
        }
        @keyframes cinch-knot-draw {
          from { stroke-dashoffset: 1; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes cinch-unravel {
          to { opacity: 0; transform: translateY(12px) rotate(8deg); }
        }
        @keyframes cinch-shudder {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          55% { transform: translateX(2.5px); }
          80% { transform: translateX(-1.5px); }
        }
        .tag-input-cord-chip { animation: cinch-in 280ms cubic-bezier(0.22, 1, 0.36, 1) backwards; }
        .tag-input-cord-chip .cinch-knot {
          stroke-dasharray: 1;
          animation: cinch-knot-draw 320ms 120ms ease-out backwards;
        }
        .tag-input-cord-chip[data-leaving="true"] {
          animation: cinch-unravel 240ms cubic-bezier(0.55, 0, 0.55, 0.2) forwards;
        }
        .tag-input-cord-chip[data-shaking="true"] { animation: cinch-shudder 280ms ease-in-out; }
        @media (prefers-reduced-motion: reduce) {
          .tag-input-cord-chip, .tag-input-cord-chip .cinch-knot,
          .tag-input-cord-chip[data-leaving="true"],
          .tag-input-cord-chip[data-shaking="true"] { animation: none; }
        }
      `}</style>
      <Cord className="w-2" />
      {tags.map((tag) => (
        <span key={tag} className="flex items-center">
          <span
            data-leaving={leaving.includes(tag) || undefined}
            data-shaking={shaking === tag || undefined}
            className="tag-input-cord-chip flex items-center gap-1.5 rounded-full border border-border bg-background py-1 pl-2 pr-1"
          >
            <Knot />
            <span className="max-w-[16ch] truncate text-xs text-foreground">{tag}</span>
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={(e) => {
                e.stopPropagation();
                unravel(tag);
              }}
              className="grid size-4 cursor-pointer place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-border hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            >
              <svg aria-hidden width={8} height={8} viewBox="0 0 8 8">
                <path
                  d="M 1.5 1.5 L 6.5 6.5 M 6.5 1.5 L 1.5 6.5"
                  stroke="currentColor"
                  strokeWidth={1.4}
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </span>
          <Cord className="w-3" />
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        aria-label={label}
        value={draft}
        placeholder={tags.length === 0 ? placeholder : ""}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        className="ml-1.5 min-w-[8ch] flex-1 bg-transparent py-0.5 text-sm text-foreground outline-none placeholder:text-muted"
      />
      <span aria-live="polite" className="sr-only">
        {tags.length} tags
      </span>
    </div>
  );
}
