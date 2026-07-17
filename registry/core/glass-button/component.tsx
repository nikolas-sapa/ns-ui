"use client";

import type { ButtonHTMLAttributes } from "react";

// ponytail: minimal seed version — ticket 3 takes this through the judge loop
export function GlassButton({
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-medium text-foreground shadow-sm backdrop-blur-xl transition-all duration-150 ease-out hover:border-white/25 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.97] dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
