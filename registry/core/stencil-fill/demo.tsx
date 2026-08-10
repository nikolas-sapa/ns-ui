"use client";

import { useState } from "react";
import { StencilFill } from "./component";

// Windows-style product-key mask (5 groups of 5) — the group shape reads as
// "software license key" at a glance, richer than a plain freeform string.
// 'O' is rejected so the signature reject beat (print at 40% muted,
// spring-shake, fall away) has something to demonstrate on its own — no
// pointer/keyboard input from a viewer required, autoplay's "type" mode
// drives real key events at the hidden input (see meta.json).
function validateLicenseChar(char: string): boolean {
  if (!/^[A-Za-z0-9]$/.test(char)) return false;
  return char.toUpperCase() !== "O";
}

export default function StencilFillDemo() {
  const [value, setValue] = useState("");

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden px-6 py-16">
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <pattern id="sf-dotgrid" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1.4" cy="1.4" r="1.4" style={{ fill: "var(--border)" }} opacity="0.55" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#sf-dotgrid)" />
      </svg>

      <p className="relative font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / stencil-fill
      </p>

      <div
        className="relative flex flex-col items-center gap-8 rounded-[1.5rem] border border-border bg-background px-12 py-14 sm:px-16"
        style={{ boxShadow: "0 32px 70px -32px color-mix(in srgb, var(--foreground) 30%, transparent)" }}
      >
        <div style={{ "--sf-size": "2.35rem" } as React.CSSProperties}>
          <StencilFill
            mask="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
            label="Product license key"
            validate={validateLicenseChar}
            autoComplete="off"
            onValueChange={setValue}
          />
        </div>

        <p className="max-w-md text-center text-xs text-ns-muted">
          Type to ink each cell from the stencil; a disallowed character (try
          &ldquo;O&rdquo;) prints faint, shakes, and falls away instead of
          silently vanishing.
        </p>

        <p aria-hidden="true" className="font-mono text-[10px] text-ns-muted">
          value: {value || "—"}
        </p>
      </div>
    </div>
  );
}
