"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

// Loading wrapper whose placeholder DEVELOPS into the real content, like a
// print coming up in a tray: on `loading` -> false both layers are stacked and
// a soft-edged alpha mask sweeps downward — the ghost blocks dissolve and
// settle upward as the children un-blur behind them, top first. No swap, no
// flash. While loading, each block carries a token-derived sweep (a recessed
// --background trough followed by a --ns-muted crest over a --border bed), not the
// white-to-grey shine every skeleton on the internet ships.
//
// Layout comes from the declarative `blocks` prop — the children are never
// measured, because while loading they are not mounted at all. Everything
// animating is CSS (compositor-friendly, zero rAF); React only runs the
// three-state phase machine. prefers-reduced-motion drops to an instant swap
// with still blocks.

export type SkeletonBlock =
  /** One emphasised bar. `width` is a fraction of the container, 0..1. */
  | { kind: "heading"; width?: number }
  /** `lines` body bars; the last one is short, the way a paragraph ends. */
  | { kind: "text"; lines?: number; width?: number }
  /** Avatar / icon disc. `size` in px. */
  | { kind: "circle"; size?: number }
  /** Media or card placeholder. `height` in px, `width` a fraction. */
  | { kind: "box"; height?: number; width?: number }
  /** Horizontal group — an avatar beside its two lines, a row of chips. */
  | { kind: "row"; gap?: number; align?: "start" | "center"; items: SkeletonBlock[] };

export interface DevelopSkeletonProps {
  /** While true the placeholder is shown; flipping it false runs the develop. */
  loading: boolean;
  /** The real content. Not rendered — and so never measured — while loading. */
  children: ReactNode;
  /** Placeholder layout. Defaults to a heading over three lines of text. */
  blocks?: SkeletonBlock[];
  /** Duration of the develop transition, ms. */
  developMs?: number;
  /** Announced to screen readers while loading. */
  loadingLabel?: string;
  className?: string;
}

type Phase = "loading" | "developing" | "ready";

const DEFAULT_BLOCKS: SkeletonBlock[] = [
  { kind: "heading", width: 0.55 },
  { kind: "text", lines: 3 },
];

const CSS = `
.ns-dev-bar{position:relative;overflow:hidden;background:var(--border)}
.ns-dev-bar::after{
  content:"";position:absolute;inset:0;
  background-image:linear-gradient(100deg,
    transparent 22%,
    color-mix(in oklab, var(--background) 55%, transparent) 39%,
    color-mix(in oklab, var(--ns-muted) 24%, transparent) 52%,
    transparent 74%);
  transform:translateX(-100%);
  /* the delay is a custom property, not animation-delay on the host element:
     animation-delay does not inherit into ::after, custom properties do */
  animation:ns-dev-sweep 2600ms cubic-bezier(.42,0,.2,1) var(--ns-dev-delay,0ms) infinite;
}
@keyframes ns-dev-sweep{0%{transform:translateX(-100%)}64%,100%{transform:translateX(100%)}}

/* Alpha masks only — the gradients below are opacity ramps, not ink. */
.ns-dev-content{
  -webkit-mask-image:linear-gradient(to bottom,rgb(0 0 0/1) 0 33%,rgb(0 0 0/0) 47% 100%);
  mask-image:linear-gradient(to bottom,rgb(0 0 0/1) 0 33%,rgb(0 0 0/0) 47% 100%);
  -webkit-mask-size:100% 300%;mask-size:100% 300%;
  -webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
  animation:ns-dev-resolve var(--ns-dev-ms) cubic-bezier(.22,1,.36,1) both;
}
@keyframes ns-dev-resolve{
  from{-webkit-mask-position:0 100%;mask-position:0 100%;filter:blur(7px) contrast(.7)}
  to{-webkit-mask-position:0 0%;mask-position:0 0%;filter:blur(0) contrast(1)}
}
.ns-dev-ghost{
  transform-origin:top center;
  -webkit-mask-image:linear-gradient(to bottom,rgb(0 0 0/0) 0 33%,rgb(0 0 0/1) 47% 100%);
  mask-image:linear-gradient(to bottom,rgb(0 0 0/0) 0 33%,rgb(0 0 0/1) 47% 100%);
  -webkit-mask-size:100% 300%;mask-size:100% 300%;
  -webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;
  animation:ns-dev-dissolve var(--ns-dev-ms) cubic-bezier(.22,1,.36,1) both;
}
@keyframes ns-dev-dissolve{
  from{-webkit-mask-position:0 100%;mask-position:0 100%;filter:blur(0);transform:scaleY(1)}
  to{-webkit-mask-position:0 0%;mask-position:0 0%;filter:blur(5px);transform:scaleY(.975)}
}
@media (prefers-reduced-motion: reduce){
  .ns-dev-bar::after{animation:none;background-image:none}
  .ns-dev-content,.ns-dev-ghost{animation:none;-webkit-mask-image:none;mask-image:none;filter:none}
}
`;

function renderBlocks(blocks: SkeletonBlock[], seq: { n: number }): ReactNode[] {
  return blocks.map((block, i) => {
    // negative delays offset each bar's sweep so the panel reads as one wave
    // travelling through it rather than every bar flashing in lockstep
    const bar = (width: number, height: number, radius: string) => (
      <div
        className={`ns-dev-bar ${radius}`}
        style={
          {
            width: `${width * 100}%`,
            height,
            "--ns-dev-delay": `${-140 * seq.n++}ms`,
          } as CSSProperties
        }
      />
    );

    switch (block.kind) {
      case "heading":
        return <div key={i}>{bar(block.width ?? 0.55, 20, "rounded-sm")}</div>;
      case "text": {
        const lines = Math.max(1, block.lines ?? 3);
        const width = block.width ?? 1;
        return (
          <div key={i} className="flex flex-col gap-3">
            {Array.from({ length: lines }, (_, l) => (
              // a paragraph's last line stops short — without it the block
              // reads as a table, not prose
              <div key={l}>{bar(l === lines - 1 ? width * 0.62 : width, 12, "rounded-full")}</div>
            ))}
          </div>
        );
      }
      case "circle": {
        const size = block.size ?? 40;
        return (
          <div
            key={i}
            className="ns-dev-bar shrink-0 rounded-full"
            style={
              { width: size, height: size, "--ns-dev-delay": `${-140 * seq.n++}ms` } as CSSProperties
            }
          />
        );
      }
      case "box":
        return <div key={i}>{bar(block.width ?? 1, block.height ?? 120, "rounded-md")}</div>;
      case "row":
        return (
          <div
            key={i}
            className="flex w-full"
            style={{ gap: block.gap ?? 12, alignItems: block.align === "center" ? "center" : "flex-start" }}
          >
            {block.items.map((item, j) => (
              // a disc keeps its own size; everything else shares the rest
              <div key={j} className={item.kind === "circle" ? "shrink-0" : "min-w-0 flex-1"}>
                {renderBlocks([item], seq)}
              </div>
            ))}
          </div>
        );
    }
  });
}

export function DevelopSkeleton({
  loading,
  children,
  blocks = DEFAULT_BLOCKS,
  developMs = 900,
  loadingLabel = "Loading",
  className = "",
}: DevelopSkeletonProps) {
  const [reduced, setReduced] = useState(false);
  const [phase, setPhase] = useState<Phase>(loading ? "loading" : "ready");
  // content that mounted already-loaded must not play a develop it never earned
  const wasLoading = useRef(loading);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (loading) {
      wasLoading.current = true;
      setPhase("loading");
      return;
    }
    if (!wasLoading.current) {
      setPhase("ready");
      return;
    }
    wasLoading.current = false;
    if (reduced) {
      setPhase("ready");
      return;
    }
    setPhase("developing");
    const id = window.setTimeout(() => setPhase("ready"), developMs);
    // flipping back to loading mid-develop lands here first: the pending
    // settle is dropped, so the ghost cannot un-hide a half-developed layer
    return () => window.clearTimeout(id);
  }, [loading, developMs, reduced]);

  const developing = phase === "developing";
  const vars = { "--ns-dev-ms": `${developMs}ms` } as CSSProperties;

  return (
    <div className={`relative ${className}`} style={vars} aria-busy={phase !== "ready"}>
      <style>{CSS}</style>

      {phase !== "loading" && (
        <div className={developing ? "ns-dev-content" : undefined}>{children}</div>
      )}

      {phase !== "ready" && (
        <div
          aria-hidden
          className={[
            "flex w-full flex-col gap-4",
            developing ? "ns-dev-ghost pointer-events-none absolute inset-0" : "",
          ].join(" ")}
        >
          {renderBlocks(blocks, { n: 0 })}
        </div>
      )}

      {phase === "loading" && (
        <span role="status" className="sr-only">
          {loadingLabel}
        </span>
      )}
    </div>
  );
}
