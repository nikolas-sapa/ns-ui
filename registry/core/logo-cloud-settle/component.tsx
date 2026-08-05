"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// LogoCloudSettle — a trust wall of abstract marks that SETTLES onto its
// grid rather than simply fading in: each tile starts lifted, shrunk and
// tilted a few degrees, then drops into its resting transform on a per-item
// stagger with a slight overshoot (a spring-approximating cubic-bezier, the
// same shape this registry already uses for its digit/avatar settles) so it
// reads as physically landing, not just appearing. This is a distinct job
// from avatar-stack-flock: that component mills continuously as a boids
// flock at rest and only resolves into a row on hover/focus; this cloud is
// static at rest and settles ONCE per viewport entry via an
// IntersectionObserver, replaying only if it leaves and re-enters view —
// there is no continuous simulation here at all, just a CSS transition
// driven by one boolean.
//
// Marks are abstract, generated geometric glyphs (no real company logos or
// wordmarks), so there is nothing here with trademark exposure. Every color
// is a Tailwind token utility (text-ns-muted / border-border / bg-surface),
// never a literal, so both themes are correct without any getComputedStyle
// bookkeeping — this is plain DOM, not canvas.
// ---------------------------------------------------------------------------

type ShapeId = "ring" | "diamond" | "triangle" | "plus" | "hex" | "venn" | "chevron" | "grid";

export interface Mark {
  id: string;
  name: string;
  shape: ShapeId;
}

const DEFAULT_MARKS: Mark[] = [
  { id: "m1", name: "Nimbus", shape: "ring" },
  { id: "m2", name: "Vectra", shape: "diamond" },
  { id: "m3", name: "Solstice", shape: "triangle" },
  { id: "m4", name: "Ashgrove", shape: "plus" },
  { id: "m5", name: "Continuum", shape: "hex" },
  { id: "m6", name: "Rivermark", shape: "venn" },
  { id: "m7", name: "Anchorpoint", shape: "chevron" },
  { id: "m8", name: "Greywolf", shape: "grid" },
];

const STAGGER_MS = 42;
const DURATION = 560;
const EASE = "cubic-bezier(0.22, 1.7, 0.36, 1)"; // spring-approximating overshoot, same family as this registry's other settles
const DROP_PX = 22;

function MarkGlyph({ shape, className = "" }: { shape: ShapeId; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (shape) {
    case "ring":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case "diamond":
      return (
        <svg {...common}>
          <path d="M12 3 L20 12 L12 21 L4 12 Z" />
        </svg>
      );
    case "triangle":
      return (
        <svg {...common}>
          <path d="M12 4 L20 19 L4 19 Z" />
          <line x1="6" y1="19" x2="18" y2="19" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <line x1="12" y1="4" x2="12" y2="20" />
          <line x1="4" y1="12" x2="20" y2="12" />
        </svg>
      );
    case "hex":
      return (
        <svg {...common}>
          <path d="M12 3 L19.5 7.5 L19.5 16.5 L12 21 L4.5 16.5 L4.5 7.5 Z" />
        </svg>
      );
    case "venn":
      return (
        <svg {...common}>
          <circle cx="9.5" cy="12" r="6" />
          <circle cx="14.5" cy="12" r="6" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...common}>
          <path d="M5 8 L12 14 L19 8" />
          <path d="M5 15 L12 21 L19 15" />
        </svg>
      );
    case "grid":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="6" height="6" />
          <rect x="14" y="4" width="6" height="6" />
          <rect x="4" y="14" width="6" height="6" />
          <rect x="14" y="14" width="6" height="6" />
        </svg>
      );
    default:
      return null;
  }
}

export function LogoCloudSettle({
  marks = DEFAULT_MARKS,
  label = "Trusted by teams shipping with ns-ui",
  className = "",
}: {
  marks?: Mark[];
  label?: string;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [settled, setSettled] = useState(false);
  const reducedRef = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedRef.current) {
      setSettled(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries[0];
        if (!hit) return;
        setSettled(hit.isIntersecting);
      },
      { threshold: 0.2 }
    );
    io.observe(root);
    return () => io.disconnect();
  }, []);

  return (
    <div className={className}>
      {label && (
        <p className="mb-5 text-center font-mono text-xs uppercase tracking-widest text-ns-muted">{label}</p>
      )}
      <div
        ref={rootRef}
        data-settled={settled}
        role="list"
        aria-label={label}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {marks.map((m, i) => (
          <div
            key={m.id}
            role="listitem"
            className="flex flex-col items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-6 text-ns-muted"
            style={{
              transitionProperty: "transform, opacity",
              transitionDuration: `${DURATION}ms`,
              transitionTimingFunction: EASE,
              transitionDelay: settled ? `${i * STAGGER_MS}ms` : "0ms",
              transform: settled
                ? "translateY(0px) scale(1) rotate(0deg)"
                : `translateY(-${DROP_PX}px) scale(0.9) rotate(-4deg)`,
              opacity: settled ? 1 : 0,
              willChange: "transform, opacity",
            }}
          >
            <MarkGlyph shape={m.shape} className="h-7 w-7" />
            <span className="font-mono text-[10px] uppercase tracking-widest">{m.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
