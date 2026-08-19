"use client";

import { useState, type ButtonHTMLAttributes, type PointerEvent } from "react";

export function GlassButton({
  className = "",
  children,
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  // Real pointers drive the native `:hover`/`:active` pseudo-classes below just
  // fine. But a synthetic (`dispatchEvent`, `isTrusted: false`) pointer never
  // reaches the UA's own hover/activation state machine — Chromium confirmed
  // not to flip `:hover`/`:active` for script-dispatched events, even though
  // the same event fires every JS listener bound to it. That left this button
  // dead in the landing-page card, whose autoplay driver only has synthetic
  // events to offer. Mirroring both states into JS-tracked data-attributes
  // (additive, not a replacement) gives the driver something that responds,
  // without changing anything for a real mouse, touch, or keyboard press.
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      data-hover={hover}
      data-press={pressed}
      onPointerEnter={(e: PointerEvent<HTMLButtonElement>) => {
        setHover(true);
        onPointerEnter?.(e);
      }}
      onPointerLeave={(e: PointerEvent<HTMLButtonElement>) => {
        setHover(false);
        setPressed(false);
        onPointerLeave?.(e);
      }}
      onPointerDown={(e: PointerEvent<HTMLButtonElement>) => {
        setPressed(true);
        onPointerDown?.(e);
      }}
      onPointerUp={(e: PointerEvent<HTMLButtonElement>) => {
        setPressed(false);
        onPointerUp?.(e);
      }}
      onPointerCancel={(e: PointerEvent<HTMLButtonElement>) => {
        setPressed(false);
        onPointerCancel?.(e);
      }}
      className={[
        "ns-bg-btn group relative inline-flex items-center justify-center overflow-hidden rounded-sm px-5 py-2.5 text-sm font-medium text-foreground",
        // glass material: translucent fill, heavy blur, saturation boost
        "bg-black/[0.04] backdrop-blur-xl backdrop-saturate-150 dark:bg-white/[0.06]",
        "border border-black/10 dark:border-white/10",
        // depth: top specular edge (inset) + soft lift shadow
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_4px_16px_-4px_rgba(0,0,0,0.15)]",
        "dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_8px_24px_-8px_rgba(0,0,0,0.5)]",
        // hover: material brightens, border sharpens, 1px lift
        // (`data-[hover=true]` mirrors `:hover` for synthetic/driver input)
        "hover:-translate-y-px hover:bg-black/[0.07] hover:border-black/15 dark:hover:bg-white/[0.1] dark:hover:border-white/20",
        "data-[hover=true]:-translate-y-px data-[hover=true]:bg-black/[0.07] data-[hover=true]:border-black/15 dark:data-[hover=true]:bg-white/[0.1] dark:data-[hover=true]:border-white/20",
        // press: springy scale-down (overshoot bezier ~ spring without a dep)
        // (`data-[press=true]` mirrors `:active` for synthetic/driver input)
        "active:translate-y-0 active:scale-[0.96]",
        "data-[press=true]:translate-y-0 data-[press=true]:scale-[0.96]",
        "transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      ].join(" ")}
      {...props}
    >
      {/* specular sheen sweeps across the glass on hover
          (`group-data-[hover=true]` mirrors `group-hover` for synthetic input) */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 rotate-12 bg-white/10 blur-sm transition-transform duration-700 ease-out group-hover:translate-x-[500%] group-data-[hover=true]:translate-x-[500%] motion-reduce:hidden"
      />
      <span className="relative">{children}</span>
    </button>
  );
}
