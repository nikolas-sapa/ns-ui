"use client";

import type { HTMLAttributes } from "react";

// tiled SVG noise grain — keeps the glass from reading as a flat blur
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function GlassPanel({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-md border",
        "border-black/10 dark:border-white/10",
        // graduated elevation ramp — depth without a single heavy shadow
        "shadow-[0_1px_2px_rgba(0,0,0,0.08),0_4px_8px_-2px_rgba(0,0,0,0.08),0_12px_24px_-6px_rgba(0,0,0,0.1),0_32px_64px_-16px_rgba(0,0,0,0.12)]",
        "dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_4px_8px_-2px_rgba(0,0,0,0.3),0_12px_24px_-6px_rgba(0,0,0,0.35),0_32px_64px_-16px_rgba(0,0,0,0.4)]",
        className,
      ].join(" ")}
      {...props}
    >
      {/* glass fill: blur + saturate the backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 bg-white/60 backdrop-blur-xl backdrop-saturate-150 dark:bg-white/[0.06]"
      />
      {/* grain */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: NOISE }}
      />
      {/* specular rim: lit from above */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-[inherit] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_1px_0_0_rgba(255,255,255,0.15),inset_-1px_0_0_rgba(255,255,255,0.15)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_1px_0_0_rgba(255,255,255,0.04),inset_-1px_0_0_rgba(255,255,255,0.04)]"
      />
      <div className="relative">{children}</div>
    </div>
  );
}
