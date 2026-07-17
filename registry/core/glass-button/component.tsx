"use client";

import type { ButtonHTMLAttributes } from "react";

export function GlassButton({
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={[
        "relative inline-flex items-center justify-center overflow-hidden rounded-sm px-5 py-2.5 text-sm font-medium text-foreground",
        // glass material: translucent fill, heavy blur, saturation boost
        "bg-black/[0.04] backdrop-blur-xl backdrop-saturate-150 dark:bg-white/[0.06]",
        "border border-black/10 dark:border-white/10",
        // depth: top specular edge (inset) + soft lift shadow
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_4px_16px_-4px_rgba(0,0,0,0.15)]",
        "dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_8px_24px_-8px_rgba(0,0,0,0.5)]",
        // hover: material brightens, border sharpens, 1px lift
        "hover:-translate-y-px hover:bg-black/[0.07] hover:border-black/15 dark:hover:bg-white/[0.1] dark:hover:border-white/20",
        // press: springy scale-down (overshoot bezier ~ spring without a dep)
        "active:translate-y-0 active:scale-[0.96]",
        "transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
